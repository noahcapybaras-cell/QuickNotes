
const STORAGE_KEY = "quicknotes_v1";

let notes = loadNotes();
let editingId = null;

const notesGrid = document.getElementById("notesGrid");
const emptyState = document.getElementById("emptyState");
const editorOverlay = document.getElementById("editorOverlay");

const titleInput = document.getElementById("noteTitle");
const contentInput = document.getElementById("noteContent");
const searchInput = document.getElementById("searchInput");

const noteCount = document.getElementById("noteCount");
const notesSubtitle = document.getElementById("notesSubtitle");
const editorLabel = document.getElementById("editorLabel");
const deleteButton = document.getElementById("deleteNoteBtn");

const fontSelect = document.getElementById("fontSelect");
const sizeSelect = document.getElementById("sizeSelect");
const textColor = document.getElementById("textColor");
const noteColor = document.getElementById("noteColor");
const pinNote = document.getElementById("pinNote");

const allowedFonts = [
    "Arial", "Georgia", "Verdana", "Courier New",
    "Trebuchet MS", "Times New Roman", "Impact"
];

// LOAD NOTES

function loadNotes() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];

        if (!Array.isArray(parsed)) return [];

        return parsed.filter(note =>
            note &&
            typeof note.id === "string" &&
            typeof note.title === "string" &&
            typeof note.content === "string"
        ).map(note => ({
            ...note,
            pinned: Boolean(note.pinned),
            color: typeof note.color === "string" ? note.color : "default",
            formatVersion: note.formatVersion || 1,
            updatedAt: Number(note.updatedAt) || Date.now()
        }));
    } catch (error) {
        console.error("Could not load notes:", error);
        return [];
    }
}

// SAVE NOTES

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        return true;
    } catch (error) {
        alert("Could not save notes. Your browser storage may be full.");
        console.error("Storage error:", error);
        return false;
    }
}

// SAFE RICH TEXT HANDLING

function sanitizeHTML(html) {
    const parser = new DOMParser();
    const documentCopy = parser.parseFromString(html, "text/html");

    const allowedTags = new Set([
        "P", "DIV", "BR", "STRONG", "B", "EM", "I",
        "U", "S", "H1", "H2", "H3", "UL", "OL",
        "LI", "BLOCKQUOTE", "SPAN", "FONT"
    ]);

    function cleanNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return document.createTextNode(node.textContent);
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return document.createDocumentFragment();
        }

        const tag = node.tagName;
        const children = Array.from(node.childNodes)
            .map(cleanNode);

        if (!allowedTags.has(tag)) {
            const fragment = document.createDocumentFragment();
            children.forEach(child => fragment.appendChild(child));
            return fragment;
        }

        const clean = document.createElement(tag.toLowerCase());

        children.forEach(child => clean.appendChild(child));

        const style = node.style;

        if (style.color && /^#[0-9a-f]{3,8}$/i.test(style.color)) {
            clean.style.color = style.color;
        }

        if (style.fontFamily) {
            const font = style.fontFamily.replace(/["']/g, "").trim();
            if (allowedFonts.includes(font)) {
                clean.style.fontFamily = font;
            }
        }

        if (["left", "center", "right", "justify"].includes(style.textAlign)) {
            clean.style.textAlign = style.textAlign;
        }

        if (tag === "FONT" && node.getAttribute("color")) {
            const color = node.getAttribute("color");
            if (/^#[0-9a-f]{3,8}$/i.test(color)) {
                clean.setAttribute("color", color);
            }
        }

        return clean;
    }

    const result = document.createElement("div");

    Array.from(documentCopy.body.childNodes)
        .map(cleanNode)
        .forEach(node => result.appendChild(node));

    return result.innerHTML;
}

function getPlainText(html) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(html, "text/html");
    return parsed.body.textContent || "";
}

function loadEditorContent(note) {
    if (note.formatVersion >= 2) {
        contentInput.innerHTML = sanitizeHTML(note.content);
    } else {
        // Older QuickNotes notes were plain text.
        contentInput.textContent = note.content;
    }
}

// RENDER NOTES

function renderNotes() {
    const query = searchInput.value.trim().toLowerCase();

    const filteredNotes = notes
        .filter(note => {
            const plainContent = getPlainText(note.content);

            return note.title.toLowerCase().includes(query) ||
                plainContent.toLowerCase().includes(query);
        })
        .sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned - a.pinned;
            return b.updatedAt - a.updatedAt;
        });

    notesGrid.replaceChildren();

    noteCount.textContent = notes.length;
    notesSubtitle.textContent =
        `${filteredNotes.length} ${filteredNotes.length === 1 ? "note" : "notes"}`;

    emptyState.style.display =
        filteredNotes.length === 0 ? "block" : "none";

    if (filteredNotes.length === 0) {
        emptyState.querySelector("h3").textContent =
            notes.length === 0 ? "No notes yet" : "No matching notes";

        emptyState.querySelector("p").textContent =
            notes.length === 0
                ? "Your next great idea deserves a place."
                : "Try searching for something else.";

        document.getElementById("emptyCreateBtn").style.display =
            notes.length === 0 ? "inline-block" : "none";

        return;
    }

    filteredNotes.forEach(note => {
        const card = document.createElement("article");
        card.className = "note-card";

        if (["purple", "blue", "green", "orange", "pink"].includes(note.color)) {
            card.classList.add(`color-${note.color}`);
        }

        const heading = document.createElement("div");
        heading.style.display = "flex";
        heading.style.alignItems = "center";
        heading.style.gap = "8px";

        const title = document.createElement("h4");
        title.textContent = note.title || "Untitled note";

        heading.appendChild(title);

        if (note.pinned) {
            const pin = document.createElement("span");
            pin.className = "pin-indicator";
            pin.textContent = "📌";
            heading.appendChild(pin);
        }

        const content = document.createElement("p");
        content.textContent = getPlainText(note.content) || "No additional content.";

        const date = document.createElement("div");
        date.className = "note-date";
        date.textContent = formatDate(note.updatedAt);

        card.append(heading, content, date);

        card.addEventListener("click", () => openEditor(note.id));

        notesGrid.appendChild(card);
    });
}

// FORMAT DATE

function formatDate(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "Recently updated";
    }

    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

// OPEN EDITOR

function openEditor(id = null) {
    editingId = id;

    if (id) {
        const note = notes.find(item => item.id === id);
        if (!note) return;

        titleInput.value = note.title;
        loadEditorContent(note);

        noteColor.value = note.color || "default";
        pinNote.checked = Boolean(note.pinned);

        editorLabel.textContent = "EDIT NOTE";
        deleteButton.style.display = "block";
    } else {
        titleInput.value = "";
        contentInput.innerHTML = "";

        noteColor.value = "default";
        pinNote.checked = false;

        editorLabel.textContent = "NEW NOTE";
        deleteButton.style.display = "none";
    }

    editorOverlay.classList.add("open");
    titleInput.focus();
}

// CLOSE EDITOR

function closeEditor() {
    editorOverlay.classList.remove("open");
    editingId = null;
}

// SAVE NOTE

function saveNote() {
    const title = titleInput.value.trim() || "Untitled note";
    const content = sanitizeHTML(contentInput.innerHTML);
    const plainContent = getPlainText(content).trim();

    if (!plainContent && title === "Untitled note") {
        titleInput.focus();
        return;
    }

    const now = Date.now();

    if (editingId) {
        const note = notes.find(item => item.id === editingId);
        if (!note) return;

        note.title = title;
        note.content = content;
        note.color = noteColor.value;
        note.pinned = pinNote.checked;
        note.formatVersion = 2;
        note.updatedAt = now;
    } else {
        notes.push({
            id: crypto.randomUUID(),
            title,
            content,
            color: noteColor.value,
            pinned: pinNote.checked,
            formatVersion: 2,
            createdAt: now,
            updatedAt: now
        });
    }

    if (!saveToStorage()) return;

    closeEditor();
    renderNotes();
}

// DELETE NOTE

function deleteNote() {
    if (!editingId) return;

    if (!confirm("Are you sure you want to delete this note?")) return;

    notes = notes.filter(note => note.id !== editingId);

    if (!saveToStorage()) return;

    closeEditor();
    renderNotes();
}

// RICH TEXT TOOLBAR

function runEditorCommand(command, value = null) {
    contentInput.focus();
    document.execCommand(command, false, value);
}

document.querySelectorAll(".tool-btn").forEach(button => {
    button.addEventListener("mousedown", event => {
        // Keep the text selection when clicking toolbar buttons.
        event.preventDefault();
    });

    button.addEventListener("click", () => {
        const command = button.dataset.command;
        const value = button.dataset.value || null;

        runEditorCommand(command, value);
    });
});

fontSelect.addEventListener("change", () => {
    runEditorCommand("fontName", fontSelect.value);
});

sizeSelect.addEventListener("change", () => {
    runEditorCommand("fontSize", sizeSelect.value);
});

textColor.addEventListener("input", () => {
    runEditorCommand("foreColor", textColor.value);
});

// EVENT LISTENERS

document.getElementById("newNoteBtn")
    .addEventListener("click", () => openEditor());

document.getElementById("emptyCreateBtn")
    .addEventListener("click", () => openEditor());

document.getElementById("saveNoteBtn")
    .addEventListener("click", saveNote);

document.getElementById("deleteNoteBtn")
    .addEventListener("click", deleteNote);

document.getElementById("closeEditorBtn")
    .addEventListener("click", closeEditor);

document.getElementById("cancelBtn")
    .addEventListener("click", closeEditor);

document.getElementById("allNotesBtn")
    .addEventListener("click", () => {
        searchInput.value = "";
        renderNotes();
    });

searchInput.addEventListener("input", renderNotes);

editorOverlay.addEventListener("click", event => {
    if (event.target === editorOverlay) closeEditor();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && editorOverlay.classList.contains("open")) {
        closeEditor();
    }

    if (
        event.ctrlKey &&
        event.key.toLowerCase() === "s" &&
        editorOverlay.classList.contains("open")
    ) {
        event.preventDefault();
        saveNote();
    }
});

// INITIALIZE

renderNotes();

console.log("QuickNotes V2 initialized successfully.");
console.log(`${notes.length} note(s) loaded.`);
