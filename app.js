// State management
const state = {
    notes: [],
    noteContents: new Map(),
    noteAliases: new Map()
};

// DOM Elements
const hierarchyInput = document.getElementById('hierarchyInput');
const parseBtn = document.getElementById('parseBtn');
const indentBtn = document.getElementById('indentBtn');
const unindentBtn = document.getElementById('unindentBtn');
const noteSection = document.getElementById('noteSection');
const noteStructure = document.getElementById('noteStructure');
const bottomBar = document.getElementById('bottomBar');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const editModal = document.getElementById('editModal');
const editModalTitle = document.getElementById('editModalTitle');
const noteContent = document.getElementById('noteContent');
const noteAliases = document.getElementById('noteAliases');
const noteIndentBtn = document.getElementById('noteIndentBtn');
const noteUnindentBtn = document.getElementById('noteUnindentBtn');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const statusMsg = document.getElementById('statusMsg');

let currentEditingNote = null;

// Debounce function for auto-save
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Auto-save function with visual feedback
function autoSave() {
    saveToLocalStorage();
    // Optional: Show a subtle save indicator
    const saveIndicator = document.createElement('div');
    saveIndicator.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 8px 16px; border-radius: 6px; font-size: 0.9em; z-index: 2000; opacity: 0; transition: opacity 0.3s;';
    saveIndicator.textContent = '✓ Saved';
    document.body.appendChild(saveIndicator);

    setTimeout(() => saveIndicator.style.opacity = '1', 10);
    setTimeout(() => {
        saveIndicator.style.opacity = '0';
        setTimeout(() => document.body.removeChild(saveIndicator), 300);
    }, 1500);
}

// Create debounced auto-save (saves 800ms after last keystroke)
const debouncedAutoSave = debounce(autoSave, 800);

// Load saved state from localStorage
function loadFromLocalStorage() {
    const saved = localStorage.getItem('obsidian-notes-mobile');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            hierarchyInput.value = data.hierarchyText || '';
            if (data.notes) {
                state.notes = data.notes;
                state.noteContents = new Map(data.noteContents || []);
                state.noteAliases = new Map(data.noteAliases || []);
                renderNoteStructure();
                noteSection.style.display = 'block';
                bottomBar.style.display = 'flex';
            }
        } catch (e) {
            console.error('Error loading saved data:', e);
        }
    }
}

// Save state to localStorage
function saveToLocalStorage() {
    const data = {
        hierarchyText: hierarchyInput.value,
        notes: state.notes,
        noteContents: Array.from(state.noteContents.entries()),
        noteAliases: Array.from(state.noteAliases.entries())
    };
    localStorage.setItem('obsidian-notes-mobile', JSON.stringify(data));
}

// Mobile-friendly indent/unindent functions
function indentCurrentLine(textarea, increase = true) {
    // Prevent keyboard from closing
    textarea.focus();
    
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const textAfterCursor = textarea.value.substring(cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];

    // Check if we're on a bullet or numbered list item
    const bulletMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);
    const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);

    if (bulletMatch) {
        const [, currentIndent, marker, content] = bulletMatch;
        const indentSize = 2; // 2 spaces per indent level
        
        if (increase) {
            // Increase indentation
            const newIndent = currentIndent + '  '; // Add 2 spaces
            const newLine = `${newIndent}${marker} ${content}`;
            const beforeLine = textBeforeCursor.slice(0, -currentLine.length);
            textarea.value = beforeLine + newLine + textAfterCursor;
            textarea.selectionStart = textarea.selectionEnd = beforeLine.length + newLine.length;
        } else {
            // Decrease indentation
            if (currentIndent.length >= indentSize) {
                const newIndent = currentIndent.slice(indentSize);
                const newLine = `${newIndent}${marker} ${content}`;
                const beforeLine = textBeforeCursor.slice(0, -currentLine.length);
                textarea.value = beforeLine + newLine + textAfterCursor;
                textarea.selectionStart = textarea.selectionEnd = beforeLine.length + newLine.length;
            }
        }

        // Trigger auto-save and maintain focus
        textarea.dispatchEvent(new Event('input'));
        setTimeout(() => textarea.focus(), 10);
    } else if (numberMatch) {
        const [, currentIndent, number, content] = numberMatch;
        const indentSize = 2; // 2 spaces per indent level
        
        if (increase) {
            // Increase indentation - preserve the period after the number
            const newIndent = currentIndent + '  '; // Add 2 spaces
            const newLine = `${newIndent}${number}. ${content}`;
            const beforeLine = textBeforeCursor.slice(0, -currentLine.length);
            textarea.value = beforeLine + newLine + textAfterCursor;
            textarea.selectionStart = textarea.selectionEnd = beforeLine.length + newLine.length;
        } else {
            // Decrease indentation - preserve the period after the number
            if (currentIndent.length >= indentSize) {
                const newIndent = currentIndent.slice(indentSize);
                const newLine = `${newIndent}${number}. ${content}`;
                const beforeLine = textBeforeCursor.slice(0, -currentLine.length);
                textarea.value = beforeLine + newLine + textAfterCursor;
                textarea.selectionStart = textarea.selectionEnd = beforeLine.length + newLine.length;
            }
        }

        // Trigger auto-save and maintain focus
        textarea.dispatchEvent(new Event('input'));
        setTimeout(() => textarea.focus(), 10);
    }
}

// Event Listeners
parseBtn.addEventListener('click', parseHierarchy);
saveBtn.addEventListener('click', exportToJSON);
loadBtn.addEventListener('click', importFromJSON);
saveNoteBtn.addEventListener('click', saveNoteContent);
// Main UI buttons (always visible)
indentBtn.addEventListener('click', (e) => {
    e.preventDefault();
    indentCurrentLine(hierarchyInput, true);
});
unindentBtn.addEventListener('click', (e) => {
    e.preventDefault();
    indentCurrentLine(hierarchyInput, false);
});
noteIndentBtn.addEventListener('click', (e) => {
    e.preventDefault();
    indentCurrentLine(noteContent, true);
});
noteUnindentBtn.addEventListener('click', (e) => {
    e.preventDefault();
    indentCurrentLine(noteContent, false);
});


document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => closeModal(editModal));
});

window.addEventListener('click', (e) => {
    if (e.target === editModal) closeModal(editModal);
});

// Auto-save listeners
hierarchyInput.addEventListener('input', debouncedAutoSave);

// Auto-save for note content and aliases (when editing a note)
function autoSaveCurrentNote() {
    if (!currentEditingNote) return;

    const content = noteContent.value.trim();
    if (content) {
        state.noteContents.set(currentEditingNote.path, content);
    } else {
        state.noteContents.delete(currentEditingNote.path);
    }

    const aliasesInput = noteAliases.value.trim();
    if (aliasesInput) {
        const aliases = aliasesInput.split(',').map(a => a.trim()).filter(a => a);
        state.noteAliases.set(currentEditingNote.path, aliases);
    } else {
        state.noteAliases.delete(currentEditingNote.path);
    }

    renderNoteStructure();
    autoSave();
}

const debouncedAutoSaveNote = debounce(autoSaveCurrentNote, 800);

noteContent.addEventListener('input', debouncedAutoSaveNote);
noteAliases.addEventListener('input', debouncedAutoSaveNote);

// Handle Tab/Shift+Tab for indenting/unindenting lists
function handleListIndentation(e, textarea) {
    if (e.key !== 'Tab') return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const textAfterCursor = textarea.value.substring(cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];

    // Check if we're on a bullet or numbered list item
    const bulletMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);
    const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);

    if (bulletMatch || numberMatch) {
        e.preventDefault();
        
        const match = bulletMatch || numberMatch;
        const [, currentIndent, marker, content] = match;
        const indentSize = 2; // 2 spaces per indent level
        
        if (e.shiftKey) {
            // Shift+Tab: Decrease indentation
            if (currentIndent.length >= indentSize) {
                const newIndent = currentIndent.slice(indentSize);
                const newLine = `${newIndent}${marker} ${content}`;
                const beforeLine = textBeforeCursor.slice(0, -currentLine.length);
                textarea.value = beforeLine + newLine + textAfterCursor;
                textarea.selectionStart = textarea.selectionEnd = beforeLine.length + newLine.length;
            }
        } else {
            // Tab: Increase indentation
            const newIndent = currentIndent + '  '; // Add 2 spaces
            const newLine = `${newIndent}${marker} ${content}`;
            const beforeLine = textBeforeCursor.slice(0, -currentLine.length);
            textarea.value = beforeLine + newLine + textAfterCursor;
            textarea.selectionStart = textarea.selectionEnd = beforeLine.length + newLine.length;
        }

        // Trigger auto-save
        textarea.dispatchEvent(new Event('input'));
    }
}

// Smart list continuation on Enter key
function handleListContinuation(e, textarea) {
    if (e.key !== 'Enter') return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];

    // Check for bullet points (-, *, +)
    const bulletMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);
    if (bulletMatch) {
        const [, indent, bullet, content] = bulletMatch;

        // If the line has no content (just the bullet), exit list mode
        if (!content.trim()) {
            e.preventDefault();
            // Remove the empty bullet and just insert a newline
            const beforeBullet = textarea.value.substring(0, cursorPos - currentLine.length);
            const afterCursor = textarea.value.substring(cursorPos);
            textarea.value = beforeBullet + '\n' + afterCursor;
            textarea.selectionStart = textarea.selectionEnd = beforeBullet.length + 1;
            return;
        }

        // Continue the list with the same bullet
        e.preventDefault();
        const newLine = `\n${indent}${bullet} `;
        const beforeCursor = textarea.value.substring(0, cursorPos);
        const afterCursor = textarea.value.substring(cursorPos);
        textarea.value = beforeCursor + newLine + afterCursor;
        textarea.selectionStart = textarea.selectionEnd = cursorPos + newLine.length;

        // Trigger auto-save
        textarea.dispatchEvent(new Event('input'));
        return;
    }

    // Check for numbered lists (1., 2., etc.)
    const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numberMatch) {
        const [, indent, number, content] = numberMatch;

        // If the line has no content (just the number), exit list mode
        if (!content.trim()) {
            e.preventDefault();
            const beforeNumber = textarea.value.substring(0, cursorPos - currentLine.length);
            const afterCursor = textarea.value.substring(cursorPos);
            textarea.value = beforeNumber + '\n' + afterCursor;
            textarea.selectionStart = textarea.selectionEnd = beforeNumber.length + 1;
            return;
        }

        // Find the next number for this indentation level
        // Look backwards through all lines to find the last numbered item at the same indent level
        let nextNumber = 1; // Default to 1 if no previous item found
        const indentLength = indent.length;
        
        // Check all lines before the current one (in reverse)
        for (let i = lines.length - 2; i >= 0; i--) {
            const line = lines[i];
            const lineNumberMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
            
            if (lineNumberMatch) {
                const [, lineIndent, lineNumber] = lineNumberMatch;
                const lineIndentLength = lineIndent.length;
                
                // If we find a line at the same indent level, increment from it
                if (lineIndentLength === indentLength) {
                    nextNumber = parseInt(lineNumber) + 1;
                    break;
                }
                // If we find a line at a shallower level, we're starting a new sub-list
                // so we should use 1 (which is already set)
                if (lineIndentLength < indentLength) {
                    break;
                }
                // If we find a line at a deeper level, keep looking
            }
        }

        // Continue the list with the calculated number
        e.preventDefault();
        const newLine = `\n${indent}${nextNumber}. `;
        const beforeCursor = textarea.value.substring(0, cursorPos);
        const afterCursor = textarea.value.substring(cursorPos);
        textarea.value = beforeCursor + newLine + afterCursor;
        textarea.selectionStart = textarea.selectionEnd = cursorPos + newLine.length;

        // Trigger auto-save
        textarea.dispatchEvent(new Event('input'));
        return;
    }
}

// Add list continuation and indentation to both textareas
hierarchyInput.addEventListener('keydown', (e) => {
    handleListIndentation(e, hierarchyInput);
    handleListContinuation(e, hierarchyInput);
});
noteContent.addEventListener('keydown', (e) => {
    handleListIndentation(e, noteContent);
    handleListContinuation(e, noteContent);
});

// Initialize
loadFromLocalStorage();

// Parse hierarchy
function parseHierarchy() {
    const text = hierarchyInput.value.trim();
    if (!text) {
        showStatus('Please enter some note titles!', 'error');
        return;
    }

    const lines = text.split('\n');
    state.notes = [];
    state.noteContents.clear();
    state.noteAliases.clear();
    const stack = [];
    let previousWasNonList = false;

    lines.forEach((line, index) => {
        // Skip completely empty lines
        if (!line.trim()) {
            previousWasNonList = false;
            return;
        }

        // Match indentation (spaces/tabs before any content)
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        
        // Match bullet points or numbered lists
        const bulletMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
        const numberMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
        
        let cleanedTitle = '';
        let level = 0;
        let isListItem = false;
        
        if (bulletMatch) {
            // Bullet list item: calculate level from spaces before bullet
            isListItem = true;
            const [, spacesBeforeBullet, bullet, content] = bulletMatch;
            cleanedTitle = content.trim();
            // Count spaces/tabs before the bullet marker
            const spaceCount = (spacesBeforeBullet.match(/ /g) || []).length;
            const tabCount = (spacesBeforeBullet.match(/\t/g) || []).length;
            level = tabCount + spaceCount;
            
            // If no leading spaces and previous line was non-list, make it a child
            if (level === 0 && previousWasNonList && stack.length > 0) {
                level = stack[stack.length - 1].level + 1;
            }
        } else if (numberMatch) {
            // Numbered list item: calculate level from spaces before number
            isListItem = true;
            const [, spacesBeforeNumber, number, content] = numberMatch;
            cleanedTitle = content.trim();
            // Count spaces/tabs before the number marker
            const spaceCount = (spacesBeforeNumber.match(/ /g) || []).length;
            const tabCount = (spacesBeforeNumber.match(/\t/g) || []).length;
            level = tabCount + spaceCount;
            
            // If no leading spaces and previous line was non-list, make it a child
            if (level === 0 && previousWasNonList && stack.length > 0) {
                level = stack[stack.length - 1].level + 1;
            }
        } else {
            // Plain text line: use existing logic
            isListItem = false;
            const trimmed = line.trim();
            cleanedTitle = trimmed;
            const spaceCount = (indent.match(/ /g) || []).length;
            const tabCount = (indent.match(/\t/g) || []).length;
            level = tabCount + spaceCount; // 1 space = 1 level (original behavior)
        }

        // Skip if title is empty after cleaning
        if (!cleanedTitle) {
            previousWasNonList = false;
            return;
        }

        const validation = validateNoteTitle(cleanedTitle);

        const note = {
            title: cleanedTitle,
            level: level,
            path: '',
            parent: null,
            children: [],
            hasWarning: !validation.valid
        };

        while (stack.length > level) {
            stack.pop();
        }

        if (stack.length > 0) {
            note.parent = stack[stack.length - 1];
            note.parent.children.push(note);
            note.path = `${note.parent.path}/${sanitizeFileName(note.title)}`;
        } else {
            note.path = sanitizeFileName(note.title);
        }

        stack.push(note);

        if (level === 0) {
            state.notes.push(note);
        }
        
        // Track if this was a non-list item for next iteration
        previousWasNonList = !isListItem;
    });

    renderNoteStructure();
    noteSection.style.display = 'block';
    bottomBar.style.display = 'flex';
    saveToLocalStorage();
    showStatus('Hierarchy parsed! Tap notes to add content.', 'success');
}

// Validate note title
function validateNoteTitle(title) {
    const invalidChars = /[#^[\]|\\/:]/;
    if (invalidChars.test(title)) {
        return {
            valid: false,
            message: 'Contains invalid characters: # ^ [ ] | \\ / :'
        };
    }
    return { valid: true };
}

// Sanitize filename
function sanitizeFileName(name) {
    return name
        .replace(/[#^[\]|\\/:]/g, '–')
        .replace(/^\.+|\.+$/g, '')
        .trim();
}

// Render note structure
function renderNoteStructure() {
    noteStructure.innerHTML = '';

    if (state.notes.length === 0) {
        noteStructure.innerHTML = '<p class="empty-state">Parse your hierarchy to see notes...</p>';
        return;
    }

    function renderNote(note) {
        const div = document.createElement('div');
        div.className = `note-item note-level-${note.level}`;

        if (state.noteContents.has(note.path)) {
            div.classList.add('has-content');
        }
        if (note.hasWarning) {
            div.classList.add('has-warning');
        }

        const titleSpan = document.createElement('span');
        titleSpan.className = 'note-title';
        titleSpan.textContent = note.title;

        const indicatorSpan = document.createElement('span');
        if (state.noteContents.has(note.path)) {
            indicatorSpan.className = 'edit-indicator';
            indicatorSpan.textContent = '✓';
        } else if (note.hasWarning) {
            indicatorSpan.className = 'warning-indicator';
            indicatorSpan.textContent = '⚠';
        }

        div.appendChild(titleSpan);
        div.appendChild(indicatorSpan);

        div.addEventListener('click', (e) => {
            e.stopPropagation();
            openNoteEditor(note);
        });

        noteStructure.appendChild(div);

        note.children.forEach(child => renderNote(child));
    }

    state.notes.forEach(note => renderNote(note));
}

// Open note editor
function openNoteEditor(note) {
    currentEditingNote = note;
    editModalTitle.textContent = note.title;
    noteContent.value = state.noteContents.get(note.path) || '';

    const aliases = state.noteAliases.get(note.path) || [];
    noteAliases.value = aliases.join(', ');

    openModal(editModal);
    noteAliases.focus();
}

// Save note content
function saveNoteContent() {
    if (!currentEditingNote) return;

    const content = noteContent.value.trim();
    if (content) {
        state.noteContents.set(currentEditingNote.path, content);
    } else {
        state.noteContents.delete(currentEditingNote.path);
    }

    const aliasesInput = noteAliases.value.trim();
    if (aliasesInput) {
        const aliases = aliasesInput.split(',').map(a => a.trim()).filter(a => a);
        state.noteAliases.set(currentEditingNote.path, aliases);
    } else {
        state.noteAliases.delete(currentEditingNote.path);
    }

    renderNoteStructure();
    closeModal(editModal);
    saveToLocalStorage();
    showStatus('Note saved!', 'success');
}

// Export to JSON
async function exportToJSON() {
    const exportData = {
        hierarchyText: hierarchyInput.value,
        notes: prepareNotesForExport(state.notes),
        timestamp: new Date().toISOString()
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const fileName = `obsidian-notes-${Date.now()}.json`;

    // Try Web Share API first (better on mobile - lets you choose location!)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName)] })) {
        try {
            const file = new File([blob], fileName, { type: 'application/json' });
            await navigator.share({
                files: [file],
                title: 'Obsidian Notes Export',
                text: 'Export from mobile note creator'
            });
            showStatus('Shared successfully!', 'success');
            return;
        } catch (err) {
            // User cancelled or share failed, fall back to download
            if (err.name !== 'AbortError') {
                console.error('Share failed:', err);
            }
        }
    }

    // Fallback: traditional download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('Downloaded! Check Downloads folder.', 'success');
}

// Prepare notes for export
function prepareNotesForExport(notes) {
    return notes.map(note => prepareNoteRecursive(note));
}

function prepareNoteRecursive(note) {
    const aliases = state.noteAliases.get(note.path) || [];
    return {
        title: note.title,
        sanitizedTitle: sanitizeFileName(note.title),
        content: state.noteContents.get(note.path) || '',
        aliases: aliases,
        path: note.path,
        children: note.children.map(child => prepareNoteRecursive(child))
    };
}

// Import from JSON
function importFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                hierarchyInput.value = data.hierarchyText || '';
                state.notes = data.notes || [];

                // Reconstruct maps and parent references
                reconstructNoteStructure(state.notes, null);

                renderNoteStructure();
                noteSection.style.display = 'block';
                bottomBar.style.display = 'flex';
                saveToLocalStorage();
                showStatus('Imported successfully!', 'success');
            } catch (error) {
                showStatus('Error importing file: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

// Reconstruct note structure from imported data
function reconstructNoteStructure(notes, parent) {
    notes.forEach(note => {
        note.parent = parent;

        // Add level based on parent
        if (parent) {
            note.level = parent.level + 1;
        } else {
            note.level = 0;
        }

        // Restore content and aliases to maps
        if (note.content) {
            state.noteContents.set(note.path, note.content);
        }
        if (note.aliases && note.aliases.length > 0) {
            state.noteAliases.set(note.path, note.aliases);
        }

        // Recursively process children
        if (note.children && note.children.length > 0) {
            reconstructNoteStructure(note.children, note);
        }
    });
}

// Modal functions
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

// Show status message
function showStatus(message, type) {
    statusMsg.innerHTML = `<div class="status-msg ${type}">${message}</div>`;
    setTimeout(() => {
        statusMsg.innerHTML = '';
    }, 3000);
}
