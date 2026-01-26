import { countColumn, Editor as CMEditor } from 'codemirror'
import 'codemirror/addon/dialog/dialog'
import 'codemirror/addon/search/search'
import 'codemirror/addon/search/searchcursor'
import 'codemirror/addon/search/jump-to-line'
import 'codemirror/addon/mode/overlay'
import 'codemirror/mode/markdown/markdown'
import 'codemirror/mode/yaml/yaml'
import 'codemirror/mode/yaml-frontmatter/yaml-frontmatter'
import 'codemirror/addon/edit/continuelist'
import { Controlled as CodeMirror } from 'react-codemirror2'

import { AppState } from '../../appState/AppState'
import { Action }   from '../../appState/Action'
import { registerScrollEditor, scrollPreview } from '../../renderPreview/scrolling'

import './Editor.css'

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

export const Editor = (props: Props) => {
  const { state, dispatch } = props
  return (
    <CodeMirror
      onBeforeChange={ (_ed, _diff, md) =>
        dispatch({ type: 'setMdAndRender', md })
      }
      onScroll={scrollPreview}
      editorDidMount={onEditorDidMount}
      value={state.doc.md}
      autoCursor={true}
      options={codeMirrorOptions}
      />
  )
}

const codeMirrorOptions = {
  mode: {
    name: 'yaml-frontmatter'
  , base: 'markdown'
  }
, theme: 'paper'
, indentUnit: 4 // because of how numbered lists behave in CommonMark
, tabSize: 4
, lineNumbers: false
, lineWrapping: true
, autofocus: true
, extraKeys: {
    Enter: 'newlineAndIndentContinueMarkdownList'
  , Tab: 'indentMore'
  , 'Shift-Tab': 'indentLess'
  }
}

const onEditorDidMount = (editor: CMEditor) => {
  editor.focus();

  // adapted from https://codemirror.net/demo/indentwrap.html
  const charWidth = editor.defaultCharWidth()
  const basePadding = 4
  // matches markdown list `-`, `+`, `*`, `1.`, `1)` and blockquote `>` markers:
  // eslint-disable-next-line no-useless-escape
  const listRe = /^(([-|\+|\*|\>]|\d+[\.|\)])\s+)(.*)/

  editor.on('renderLine', (cm, line, elt) => {
    const txt = line.text
    const matches = txt.trim().match(listRe)
    if (matches && matches[1]) {
      const extraIndent = matches[1].length
      const columnCount = countColumn(txt, null, cm.getOption('tabSize') || 4)
      const off = (columnCount + extraIndent) * charWidth
      elt.style.textIndent = '-' + off + 'px';
      elt.style.paddingLeft = (basePadding + off) + 'px';
    }
  });
  editor.refresh();

  registerScrollEditor(editor);

  let searchCloseFunc: (() => void) | null = null

  const refocusSearchInput = (ed: CMEditor) => {
    requestAnimationFrame(() => {
      const wrapper = ed.getWrapperElement()
      const input = wrapper.querySelector('.CodeMirror-search-field') as HTMLInputElement | null
      if (input && document.contains(input)) {
        input.focus()
      }
    })
  }

  const openSearch = (ed: CMEditor) => {
    const wrapper = ed.getWrapperElement()

    // If dialog already open, just refocus it
    const existingInput = wrapper.querySelector('.CodeMirror-search-field') as HTMLInputElement | null
    if (existingInput && document.contains(existingInput)) {
      existingInput.focus()
      existingInput.select()
      return
    }

    // Monkey-patch openDialog to inject closeOnBlur: false for this one call
    const origOpenDialog = (ed as any).openDialog
    ;(ed as any).openDialog = function(template: any, callback: any, options: any) {
      options = { ...options, closeOnBlur: false }
      searchCloseFunc = origOpenDialog.call(this, template, callback, options)
      ;(ed as any).openDialog = origOpenDialog
      return searchCloseFunc
    }
    ed.execCommand('findPersistent')

    // Attach handlers after dialog renders
    requestAnimationFrame(() => {
      const input = wrapper.querySelector('.CodeMirror-search-field') as HTMLInputElement | null
      if (!input || input.dataset.searchHandlersAttached) return
      input.dataset.searchHandlersAttached = 'true'

      // After CM's searchNext moves focus to editor, bring it back
      input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          refocusSearchInput(ed)
        }
      })

      // Click in editor content closes the dialog (replaces closeOnBlur)
      const onWrapperMouseDown = (e: MouseEvent) => {
        const dialog = wrapper.querySelector('.CodeMirror-dialog')
        if (!dialog) {
          wrapper.removeEventListener('mousedown', onWrapperMouseDown, true)
          return
        }
        if (!dialog.contains(e.target as Node)) {
          if (searchCloseFunc) {
            searchCloseFunc()
            searchCloseFunc = null
          }
          wrapper.removeEventListener('mousedown', onWrapperMouseDown, true)
        }
      }
      wrapper.addEventListener('mousedown', onWrapperMouseDown, true)
    })
  }

  // Override CodeMirror's default find keymap with our custom search behavior
  editor.addKeyMap({
    'Ctrl-F': () => openSearch(editor),
    'Cmd-F': () => openSearch(editor),
    'F3': () => { editor.execCommand('findPersistentNext'); refocusSearchInput(editor) },
    'Shift-F3': () => { editor.execCommand('findPersistentPrev'); refocusSearchInput(editor) },
    'Ctrl-G': () => { editor.execCommand('findPersistentNext'); refocusSearchInput(editor) },
    'Shift-Ctrl-G': () => { editor.execCommand('findPersistentPrev'); refocusSearchInput(editor) },
    'Cmd-G': () => { editor.execCommand('findPersistentNext'); refocusSearchInput(editor) },
    'Shift-Cmd-G': () => { editor.execCommand('findPersistentPrev'); refocusSearchInput(editor) },
  })

  // Keep IPC handlers as backup (for menu-triggered actions)
  window.ipcApi?.on.find(() => openSearch(editor))
  window.ipcApi?.on.findNext(() => {
    editor.execCommand('findPersistentNext')
    refocusSearchInput(editor)
  })
  window.ipcApi?.on.findPrevious(() => {
    editor.execCommand('findPersistentPrev')
    refocusSearchInput(editor)
  })


  const replaceSelection = (fn: (s: string) => string) =>
    editor.replaceSelection( fn( editor.getSelection() ) )

  window.ipcApi?.on.addBold(          () => replaceSelection(s => ['**', s, '**'].join('')) )
  window.ipcApi?.on.addItalic(        () => replaceSelection(s => ['_',  s, '_' ].join('')) )
  window.ipcApi?.on.addStrikethrough( () => replaceSelection(s => ['~~', s, '~~'].join('')) )
}
