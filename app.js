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
// Helper function to calculate the correct number for a given indent level
function calculateNumberForIndent(lines, targetIndentLength) {
    let nextNumber = 1;

    // Look backwards through previous lines to find the last number at this indent level
    // BUT if we hit a shallower indent first, reset to 1 (new hierarchy branch)
    for (let i = lines.length - 2; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        const lineNumberMatch = lines[i].match(/^(\s*)(\d+)\.\s*(.*)$/);
        const bulletMatch = lines[i].match(/^(\s*)([-*+])\s+(.*)$/);
        const plainMatch = lines[i].match(/^(\s*)(.+)$/);

        let lineIndentLength = 0;

        if (lineNumberMatch) {
            const [, lineIndent, lineNumber] = lineNumberMatch;
            lineIndentLength = lineIndent.length;

            // If we find a shallower indent, this is a new branch - reset to 1
            if (lineIndentLength < targetIndentLength) {
                nextNumber = 1;
                break;
            }

            // If we find the same indent level, continue from that number
            if (lineIndentLength === targetIndentLength) {
                nextNumber = parseInt(lineNumber, 10) + 1;
                break;
            }
        } else if (bulletMatch) {
            const [, lineIndent] = bulletMatch;
            lineIndentLength = lineIndent.length;

            // Hit a shallower bullet point - new branch
            if (lineIndentLength < targetIndentLength) {
                nextNumber = 1;
                break;
            }
        } else if (plainMatch && line) {
            const [, lineIndent] = plainMatch;
            lineIndentLength = lineIndent.length;

            // Hit a shallower non-list line - new branch
            if (lineIndentLength < targetIndentLength) {
                nextNumber = 1;
                break;
            }
        }
    }

    return nextNumber;
}

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
    const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s*(.*)$/);

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
            // Increase indentation - recalculate number for new indent level
            const newIndent = currentIndent + '  '; // Add 2 spaces
            const newNumber = calculateNumberForIndent(lines, newIndent.length);
            const newLine = `${newIndent}${newNumber}. ${content}`;
            const beforeLine = textBeforeCursor.slice(0, -currentLine.length);
            textarea.value = beforeLine + newLine + textAfterCursor;
            textarea.selectionStart = textarea.selectionEnd = beforeLine.length + newLine.length;
        } else {
            // Decrease indentation - recalculate number for new indent level
            if (currentIndent.length >= indentSize) {
                const newIndent = currentIndent.slice(indentSize);
                const newNumber = calculateNumberForIndent(lines, newIndent.length);
                const newLine = `${newIndent}${newNumber}. ${content}`;
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


// Close button handlers are set up in the Octopart section below

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
    const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s*(.*)$/);

    if (bulletMatch || numberMatch) {
        e.preventDefault();

        const indentSize = 2; // 2 spaces per indent level

        if (bulletMatch) {
            // Handle bullet lists
            const [, currentIndent, marker, content] = bulletMatch;

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
        } else if (numberMatch) {
            // Handle numbered lists - recalculate number for new indent level
            const [, currentIndent, number, content] = numberMatch;

            if (e.shiftKey) {
                // Shift+Tab: Decrease indentation
                if (currentIndent.length >= indentSize) {
                    const newIndent = currentIndent.slice(indentSize);
                    const newNumber = calculateNumberForIndent(lines, newIndent.length);
                    const newLine = `${newIndent}${newNumber}. ${content}`;
                    const beforeLine = textBeforeCursor.slice(0, -currentLine.length);
                    textarea.value = beforeLine + newLine + textAfterCursor;
                    textarea.selectionStart = textarea.selectionEnd = beforeLine.length + newLine.length;
                }
            } else {
                // Tab: Increase indentation
                const newIndent = currentIndent + '  '; // Add 2 spaces
                const newNumber = calculateNumberForIndent(lines, newIndent.length);
                const newLine = `${newIndent}${newNumber}. ${content}`;
                const beforeLine = textBeforeCursor.slice(0, -currentLine.length);
                textarea.value = beforeLine + newLine + textAfterCursor;
                textarea.selectionStart = textarea.selectionEnd = beforeLine.length + newLine.length;
            }
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
    const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s*(.*)$/);
    if (numberMatch) {
        const [, indent, number, content] = numberMatch;

        const indentLength = indent.length;

        // If the line has no content (just the number), exit list mode
        if (!content.trim()) {
            e.preventDefault();
            const beforeNumber = textarea.value.substring(0, cursorPos - currentLine.length);
            const afterCursor = textarea.value.substring(cursorPos);
            textarea.value = beforeNumber + '\n' + afterCursor;
            textarea.selectionStart = textarea.selectionEnd = beforeNumber.length + 1;
            return;
        }

        // Find the next number for this hierarchy level
        // Start at 1 by default (for new sub-lists)
        let nextNumber = 1;

        // Look backwards through all previous lines INCLUDING current to find the last number at this indent level
        // BUT if we hit a shallower indent first, reset to 1 (new hierarchy branch)
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            const trimmedLine = line.trim();
            if (!trimmedLine) continue; // Skip empty lines

            const lineNumberMatch = line.match(/^(\s*)(\d+)\.\s*(.*)$/);
            const bulletMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
            const plainMatch = line.match(/^(\s*)(.+)$/);

            let lineIndentLength = 0;

            if (lineNumberMatch) {
                const [, lineIndent, lineNumber] = lineNumberMatch;
                lineIndentLength = lineIndent.length;

                // If we find a shallower indent, this is a new branch - reset to 1
                if (lineIndentLength < indentLength) {
                    nextNumber = 1;
                    break;
                }

                // If we find the same indent level, continue from that number
                if (lineIndentLength === indentLength) {
                    nextNumber = parseInt(lineNumber, 10) + 1;
                    break;
                }
            } else if (bulletMatch) {
                const [, lineIndent] = bulletMatch;
                lineIndentLength = lineIndent.length;

                // Hit a shallower bullet point - new branch
                if (lineIndentLength < indentLength) {
                    nextNumber = 1;
                    break;
                }
            } else if (plainMatch && trimmedLine) {
                const [, lineIndent] = plainMatch;
                lineIndentLength = lineIndent.length;

                // Hit a shallower non-list line - new branch
                if (lineIndentLength < indentLength) {
                    nextNumber = 1;
                    break;
                }
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
        const numberMatch = line.match(/^(\s*)(\d+)\.\s*(.*)$/);
        
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

// ==========================================
// OCTOPART API INTEGRATION
// ==========================================

// Octopart State
const octopartState = {
    apiKey: localStorage.getItem('octopart-api-key') || '',
    useDemoMode: localStorage.getItem('octopart-demo-mode') === 'true',
    currentComponent: null,
    searchResults: []
};

// Octopart DOM Elements
const componentSearch = document.getElementById('componentSearch');
const searchBtn = document.getElementById('searchBtn');
const componentResults = document.getElementById('componentResults');
const octopartSettingsBtn = document.getElementById('octopartSettingsBtn');
const octopartSettingsModal = document.getElementById('octopartSettingsModal');
const octopartApiKey = document.getElementById('octopartApiKey');
const useDemoMode = document.getElementById('useDemoMode');
const saveOctopartSettings = document.getElementById('saveOctopartSettings');
const componentModal = document.getElementById('componentModal');
const componentModalTitle = document.getElementById('componentModalTitle');
const componentModalBody = document.getElementById('componentModalBody');
const createComponentNote = document.getElementById('createComponentNote');

// Demo component data for when no API key is available
const demoComponents = {
    'LM7805': {
        mpn: 'LM7805CT',
        manufacturer: 'Texas Instruments',
        description: '3-Terminal Positive Voltage Regulator, 5V 1.5A Output',
        category: 'Voltage Regulators',
        specs: {
            'Output Voltage': '5V',
            'Output Current': '1.5A',
            'Input Voltage': '7V - 25V',
            'Package': 'TO-220',
            'Operating Temp': '-40°C to 125°C',
            'Dropout Voltage': '2V'
        },
        pricing: [
            { distributor: 'Digi-Key', qty: 1, price: 0.72, stock: 15420 },
            { distributor: 'Mouser', qty: 1, price: 0.69, stock: 8750 },
            { distributor: 'Newark', qty: 10, price: 0.58, stock: 3200 }
        ],
        datasheets: ['https://www.ti.com/lit/ds/symlink/lm7805.pdf'],
        octopartUrl: 'https://octopart.com/lm7805ct-texas+instruments-530748'
    },
    'ATMEGA328P': {
        mpn: 'ATMEGA328P-PU',
        manufacturer: 'Microchip Technology',
        description: '8-bit AVR Microcontroller with 32KB Flash, Arduino Compatible',
        category: 'Microcontrollers',
        specs: {
            'Core': 'AVR 8-bit',
            'Flash Memory': '32KB',
            'SRAM': '2KB',
            'EEPROM': '1KB',
            'Clock Speed': 'Up to 20MHz',
            'I/O Pins': '23',
            'Package': 'DIP-28',
            'Operating Voltage': '1.8V - 5.5V'
        },
        pricing: [
            { distributor: 'Digi-Key', qty: 1, price: 2.85, stock: 28500 },
            { distributor: 'Mouser', qty: 1, price: 2.79, stock: 12300 },
            { distributor: 'Arrow', qty: 25, price: 2.45, stock: 5600 }
        ],
        datasheets: ['https://ww1.microchip.com/downloads/en/DeviceDoc/ATmega328P-Complete.pdf'],
        octopartUrl: 'https://octopart.com/atmega328p-pu-microchip-77760008'
    },
    'NE555': {
        mpn: 'NE555P',
        manufacturer: 'Texas Instruments',
        description: 'Precision Timer IC, Single, 4.5V to 16V',
        category: 'Timer ICs',
        specs: {
            'Timer Type': 'General Purpose',
            'Timing Range': '1μs to hours',
            'Supply Voltage': '4.5V - 16V',
            'Output Current': '200mA',
            'Package': 'DIP-8',
            'Operating Temp': '0°C to 70°C'
        },
        pricing: [
            { distributor: 'Digi-Key', qty: 1, price: 0.42, stock: 95000 },
            { distributor: 'Mouser', qty: 1, price: 0.39, stock: 67000 },
            { distributor: 'Newark', qty: 100, price: 0.28, stock: 45000 }
        ],
        datasheets: ['https://www.ti.com/lit/ds/symlink/ne555.pdf'],
        octopartUrl: 'https://octopart.com/ne555p-texas+instruments-527418'
    },
    'ESP32': {
        mpn: 'ESP32-WROOM-32E',
        manufacturer: 'Espressif Systems',
        description: 'WiFi & Bluetooth MCU Module, Dual-Core 240MHz, 4MB Flash',
        category: 'Wireless Modules',
        specs: {
            'Core': 'Dual Xtensa LX6',
            'Clock Speed': '240MHz',
            'Flash': '4MB',
            'WiFi': '802.11 b/g/n',
            'Bluetooth': 'BLE 4.2',
            'GPIO Pins': '34',
            'Operating Voltage': '3.0V - 3.6V',
            'Dimensions': '18mm x 25.5mm'
        },
        pricing: [
            { distributor: 'Digi-Key', qty: 1, price: 2.90, stock: 42000 },
            { distributor: 'Mouser', qty: 1, price: 2.85, stock: 28000 },
            { distributor: 'LCSC', qty: 10, price: 2.35, stock: 156000 }
        ],
        datasheets: ['https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_datasheet_en.pdf'],
        octopartUrl: 'https://octopart.com/esp32-wroom-32e-espressif+systems-100246230'
    },
    '2N2222': {
        mpn: '2N2222A',
        manufacturer: 'ON Semiconductor',
        description: 'NPN General Purpose Transistor, 40V 600mA',
        category: 'Transistors',
        specs: {
            'Type': 'NPN',
            'Collector-Emitter Voltage': '40V',
            'Collector Current': '600mA',
            'Power Dissipation': '625mW',
            'hFE (Gain)': '100 - 300',
            'Package': 'TO-92',
            'Transition Frequency': '300MHz'
        },
        pricing: [
            { distributor: 'Digi-Key', qty: 1, price: 0.18, stock: 250000 },
            { distributor: 'Mouser', qty: 1, price: 0.16, stock: 180000 },
            { distributor: 'Newark', qty: 100, price: 0.08, stock: 95000 }
        ],
        datasheets: ['https://www.onsemi.com/pdf/datasheet/p2n2222a-d.pdf'],
        octopartUrl: 'https://octopart.com/2n2222a-on+semiconductor-42203'
    },
    '1N4148': {
        mpn: '1N4148',
        manufacturer: 'Vishay',
        description: 'Small Signal Fast Switching Diode, 100V 200mA',
        category: 'Diodes',
        specs: {
            'Type': 'Small Signal',
            'Reverse Voltage': '100V',
            'Forward Current': '200mA',
            'Forward Voltage': '1V @ 10mA',
            'Recovery Time': '4ns',
            'Package': 'DO-35'
        },
        pricing: [
            { distributor: 'Digi-Key', qty: 1, price: 0.05, stock: 1200000 },
            { distributor: 'Mouser', qty: 1, price: 0.04, stock: 890000 },
            { distributor: 'LCSC', qty: 100, price: 0.01, stock: 5000000 }
        ],
        datasheets: ['https://www.vishay.com/docs/81857/1n4148.pdf'],
        octopartUrl: 'https://octopart.com/1n4148-vishay-39459'
    },
    '10K': {
        mpn: 'CFR-25JB-52-10K',
        manufacturer: 'Yageo',
        description: 'Carbon Film Resistor 10K Ohm 1/4W 5%',
        category: 'Resistors',
        specs: {
            'Resistance': '10kΩ',
            'Power Rating': '0.25W',
            'Tolerance': '±5%',
            'Temperature Coefficient': '±200ppm/°C',
            'Package': 'Axial',
            'Lead Spacing': '10mm'
        },
        pricing: [
            { distributor: 'Digi-Key', qty: 1, price: 0.10, stock: 2500000 },
            { distributor: 'Mouser', qty: 1, price: 0.08, stock: 1800000 },
            { distributor: 'LCSC', qty: 100, price: 0.005, stock: 10000000 }
        ],
        datasheets: ['https://www.yageo.com/upload/media/product/products/datasheet/lr/YAGEO_LR_CFR_1.pdf'],
        octopartUrl: 'https://octopart.com/cfr-25jb-52-10k-yageo-170919'
    },
    'STM32F103': {
        mpn: 'STM32F103C8T6',
        manufacturer: 'STMicroelectronics',
        description: 'ARM Cortex-M3 MCU, 72MHz, 64KB Flash, 20KB SRAM (Blue Pill)',
        category: 'Microcontrollers',
        specs: {
            'Core': 'ARM Cortex-M3',
            'Clock Speed': '72MHz',
            'Flash': '64KB',
            'SRAM': '20KB',
            'GPIO Pins': '37',
            'ADC': '2x 12-bit',
            'Package': 'LQFP-48',
            'Operating Voltage': '2.0V - 3.6V'
        },
        pricing: [
            { distributor: 'Digi-Key', qty: 1, price: 3.42, stock: 18500 },
            { distributor: 'Mouser', qty: 1, price: 3.38, stock: 12000 },
            { distributor: 'LCSC', qty: 10, price: 2.85, stock: 85000 }
        ],
        datasheets: ['https://www.st.com/resource/en/datasheet/stm32f103c8.pdf'],
        octopartUrl: 'https://octopart.com/stm32f103c8t6-stmicroelectronics-20312179'
    }
};

// Initialize Octopart settings
function initOctopartSettings() {
    octopartApiKey.value = octopartState.apiKey;
    useDemoMode.checked = octopartState.useDemoMode;
}

// Save Octopart settings
function saveOctopartSettingsHandler() {
    octopartState.apiKey = octopartApiKey.value.trim();
    octopartState.useDemoMode = useDemoMode.checked;

    localStorage.setItem('octopart-api-key', octopartState.apiKey);
    localStorage.setItem('octopart-demo-mode', octopartState.useDemoMode);

    closeModal(octopartSettingsModal);
    showStatus('Octopart settings saved!', 'success');
}

// Search for components
async function searchComponents() {
    const query = componentSearch.value.trim();
    if (!query) {
        showStatus('Please enter a part number to search', 'error');
        return;
    }

    componentResults.innerHTML = '<div class="loading-spinner">Searching components...</div>';

    // Check if we should use demo mode
    const useDemo = octopartState.useDemoMode || !octopartState.apiKey;

    if (useDemo) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        searchDemoComponents(query);
    } else {
        await searchOctopartAPI(query);
    }
}

// Search demo components
function searchDemoComponents(query) {
    const normalizedQuery = query.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const results = [];

    for (const [key, component] of Object.entries(demoComponents)) {
        const normalizedKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const normalizedMpn = component.mpn.toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (normalizedKey.includes(normalizedQuery) ||
            normalizedMpn.includes(normalizedQuery) ||
            normalizedQuery.includes(normalizedKey)) {
            results.push({ ...component, isDemo: true });
        }
    }

    // If no exact match, show all demo components as suggestions
    if (results.length === 0) {
        for (const component of Object.values(demoComponents)) {
            results.push({ ...component, isDemo: true });
        }
    }

    octopartState.searchResults = results;
    renderSearchResults(results, true);
}

// Search Octopart API (GraphQL)
async function searchOctopartAPI(query) {
    const graphqlQuery = `
        query SearchParts($q: String!) {
            supSearchMpn(q: $q, limit: 10) {
                hits
                results {
                    part {
                        mpn
                        manufacturer {
                            name
                        }
                        shortDescription
                        category {
                            name
                        }
                        bestDatasheet {
                            url
                        }
                        specs {
                            attribute {
                                name
                            }
                            displayValue
                        }
                        sellers(authorizedOnly: false) {
                            company {
                                name
                            }
                            offers {
                                inventoryLevel
                                prices {
                                    quantity
                                    price
                                    currency
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

    try {
        const response = await fetch('https://octopart.com/api/v4/endpoint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${octopartState.apiKey}`
            },
            body: JSON.stringify({
                query: graphqlQuery,
                variables: { q: query }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.errors) {
            throw new Error(data.errors[0].message);
        }

        const results = data.data.supSearchMpn.results.map(result => {
            const part = result.part;
            const specs = {};

            if (part.specs) {
                part.specs.forEach(spec => {
                    specs[spec.attribute.name] = spec.displayValue;
                });
            }

            const pricing = [];
            if (part.sellers) {
                part.sellers.slice(0, 5).forEach(seller => {
                    if (seller.offers && seller.offers.length > 0) {
                        const offer = seller.offers[0];
                        if (offer.prices && offer.prices.length > 0) {
                            pricing.push({
                                distributor: seller.company.name,
                                qty: offer.prices[0].quantity,
                                price: offer.prices[0].price,
                                stock: offer.inventoryLevel || 0
                            });
                        }
                    }
                });
            }

            return {
                mpn: part.mpn,
                manufacturer: part.manufacturer?.name || 'Unknown',
                description: part.shortDescription || 'No description available',
                category: part.category?.name || 'Components',
                specs: specs,
                pricing: pricing,
                datasheets: part.bestDatasheet ? [part.bestDatasheet.url] : [],
                octopartUrl: `https://octopart.com/search?q=${encodeURIComponent(part.mpn)}`,
                isDemo: false
            };
        });

        octopartState.searchResults = results;
        renderSearchResults(results, false);

    } catch (error) {
        console.error('Octopart API Error:', error);
        componentResults.innerHTML = `
            <div class="empty-results">
                <p>API Error: ${error.message}</p>
                <p style="margin-top: 10px; font-size: 0.9em;">Falling back to demo mode...</p>
            </div>
        `;
        // Fall back to demo mode
        setTimeout(() => searchDemoComponents(query), 1000);
    }
}

// Render search results
function renderSearchResults(results, isDemo) {
    if (results.length === 0) {
        componentResults.innerHTML = '<div class="empty-results">No components found. Try a different search term.</div>';
        return;
    }

    const demoBadge = isDemo ? '<span class="demo-badge">DEMO DATA</span>' : '';

    componentResults.innerHTML = results.map((component, index) => `
        <div class="component-card" data-index="${index}">
            <div class="component-card-header">
                <div>
                    <div class="component-mpn">${escapeHtml(component.mpn)}${component.isDemo ? '<span class="demo-badge">DEMO</span>' : ''}</div>
                    <div class="component-manufacturer">${escapeHtml(component.manufacturer)}</div>
                </div>
            </div>
            <div class="component-description">${escapeHtml(component.description)}</div>
            <div class="component-meta">
                <span class="component-tag">${escapeHtml(component.category)}</span>
                ${component.pricing.length > 0 ? `
                    <span class="component-tag price">$${component.pricing[0].price.toFixed(2)}</span>
                    <span class="component-tag ${component.pricing[0].stock > 0 ? 'stock' : 'out-of-stock'}">
                        ${component.pricing[0].stock > 0 ? `${component.pricing[0].stock.toLocaleString()} in stock` : 'Out of stock'}
                    </span>
                ` : ''}
            </div>
        </div>
    `).join('');

    // Add click handlers
    componentResults.querySelectorAll('.component-card').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.index);
            showComponentDetails(octopartState.searchResults[index]);
        });
    });
}

// Show component details modal
function showComponentDetails(component) {
    octopartState.currentComponent = component;
    componentModalTitle.textContent = component.mpn;

    const specsHtml = Object.keys(component.specs).length > 0 ? `
        <div class="component-detail-section">
            <h3>Specifications</h3>
            <div class="spec-list">
                ${Object.entries(component.specs).map(([key, value]) => `
                    <div class="spec-item">
                        <span class="spec-label">${escapeHtml(key)}</span>
                        <span class="spec-value">${escapeHtml(value)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    const pricingHtml = component.pricing.length > 0 ? `
        <div class="component-detail-section">
            <h3>Pricing & Availability</h3>
            <table class="price-table">
                <thead>
                    <tr>
                        <th>Distributor</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Stock</th>
                    </tr>
                </thead>
                <tbody>
                    ${component.pricing.map(p => `
                        <tr>
                            <td>${escapeHtml(p.distributor)}</td>
                            <td>${p.qty}+</td>
                            <td>$${p.price.toFixed(2)}</td>
                            <td>${p.stock.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    const datasheetsHtml = component.datasheets.length > 0 ? `
        <div class="component-detail-section">
            <h3>Documentation</h3>
            ${component.datasheets.map((url, i) => `
                <a href="${escapeHtml(url)}" target="_blank" class="datasheet-link">📄 Datasheet${component.datasheets.length > 1 ? ` ${i + 1}` : ''}</a>
            `).join('')}
            <a href="${escapeHtml(component.octopartUrl)}" target="_blank" class="datasheet-link">🔗 View on Octopart</a>
        </div>
    ` : '';

    componentModalBody.innerHTML = `
        <div class="component-detail-section">
            <h3>Overview</h3>
            <p><strong>Manufacturer:</strong> ${escapeHtml(component.manufacturer)}</p>
            <p><strong>Part Number:</strong> ${escapeHtml(component.mpn)}</p>
            <p><strong>Category:</strong> ${escapeHtml(component.category)}</p>
            <p style="margin-top: 10px;">${escapeHtml(component.description)}</p>
            ${component.isDemo ? '<p style="margin-top: 10px;"><span class="demo-badge">DEMO DATA</span> This is sample data. Add an API key for real results.</p>' : ''}
        </div>
        ${specsHtml}
        ${pricingHtml}
        ${datasheetsHtml}
    `;

    openModal(componentModal);
}

// Create note from component
function createNoteFromComponent() {
    const component = octopartState.currentComponent;
    if (!component) return;

    // Create the note hierarchy text
    const noteTitle = component.mpn;
    const specsText = Object.entries(component.specs)
        .map(([key, value]) => `  - ${key}: ${value}`)
        .join('\n');

    const pricingText = component.pricing
        .map(p => `  - ${p.distributor}: $${p.price.toFixed(2)} (${p.stock.toLocaleString()} in stock)`)
        .join('\n');

    // Build the hierarchy
    let hierarchyText = `${noteTitle}\n`;
    hierarchyText += `- Overview\n`;

    if (Object.keys(component.specs).length > 0) {
        hierarchyText += `- Specifications\n`;
    }

    if (component.pricing.length > 0) {
        hierarchyText += `- Pricing\n`;
    }

    if (component.datasheets.length > 0) {
        hierarchyText += `- Documentation\n`;
    }

    // Add to the existing hierarchy or replace
    const existingText = hierarchyInput.value.trim();
    if (existingText) {
        hierarchyInput.value = existingText + '\n\n' + hierarchyText;
    } else {
        hierarchyInput.value = hierarchyText;
    }

    // Parse the hierarchy
    parseHierarchy();

    // Now add content to each note
    const basePath = sanitizeFileName(noteTitle);

    // Overview content
    const overviewContent = `**Manufacturer:** ${component.manufacturer}
**Part Number:** ${component.mpn}
**Category:** ${component.category}

${component.description}

${component.datasheets.length > 0 ? `**Datasheet:** [${component.mpn} Datasheet](${component.datasheets[0]})` : ''}
**Octopart:** [View on Octopart](${component.octopartUrl})`;

    state.noteContents.set(`${basePath}/Overview`, overviewContent);

    // Specifications content
    if (Object.keys(component.specs).length > 0) {
        const specsContent = Object.entries(component.specs)
            .map(([key, value]) => `- **${key}:** ${value}`)
            .join('\n');
        state.noteContents.set(`${basePath}/Specifications`, specsContent);
    }

    // Pricing content
    if (component.pricing.length > 0) {
        const pricingContent = `| Distributor | Qty | Price | Stock |
|-------------|-----|-------|-------|
${component.pricing.map(p => `| ${p.distributor} | ${p.qty}+ | $${p.price.toFixed(2)} | ${p.stock.toLocaleString()} |`).join('\n')}

*Pricing data ${component.isDemo ? '(demo data)' : `retrieved ${new Date().toLocaleDateString()}`}*`;
        state.noteContents.set(`${basePath}/Pricing`, pricingContent);
    }

    // Documentation content
    if (component.datasheets.length > 0) {
        const docsContent = `## Datasheets
${component.datasheets.map((url, i) => `- [Datasheet${component.datasheets.length > 1 ? ` ${i + 1}` : ''}](${url})`).join('\n')}

## External Links
- [View on Octopart](${component.octopartUrl})
- [Manufacturer Website](https://www.google.com/search?q=${encodeURIComponent(component.manufacturer + ' ' + component.mpn)})`;
        state.noteContents.set(`${basePath}/Documentation`, docsContent);
    }

    // Re-render and save
    renderNoteStructure();
    saveToLocalStorage();
    closeModal(componentModal);
    showStatus(`Created notes for ${component.mpn}!`, 'success');
}

// Escape HTML helper
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Octopart Event Listeners
searchBtn.addEventListener('click', searchComponents);
componentSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        searchComponents();
    }
});

octopartSettingsBtn.addEventListener('click', () => {
    initOctopartSettings();
    openModal(octopartSettingsModal);
});

saveOctopartSettings.addEventListener('click', saveOctopartSettingsHandler);

createComponentNote.addEventListener('click', createNoteFromComponent);

// Close modals
document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        if (modal) closeModal(modal);
    });
});

window.addEventListener('click', (e) => {
    if (e.target === editModal) closeModal(editModal);
    if (e.target === octopartSettingsModal) closeModal(octopartSettingsModal);
    if (e.target === componentModal) closeModal(componentModal);
});
