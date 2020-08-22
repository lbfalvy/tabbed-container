import { hasPart, addPart, removePart } from "./parts.mjs";

// Generate unique identifiers
var next_uid = 0;
/** @returns {Number} */
var getUid = () => next_uid++;
// Call this to set your own method
/** @param {() => Number} gen */
export function setUidGenerator(gen) {
    getUid = gen;
}

const css = `
#shadow-top {
    display: flex;
    flex-direction: column;
    height: 100%;
}
#tabs {
    flex: 0 0;
    user-select: none;
}
#tabs > * {
    display: inline-block;
    cursor: pointer;
}
#tabs > span:first-child {
    margin-left: 0px !important;
}
#tabs::after {
    display: block;
    float: right;
    content: "0";
    visibility: hidden;
}
#contents {
    position: relative;
    flex: 1 1;
}
#contents > * {
    position: absolute;
    display: none;
    top: 0; left: 0; right: 0; bottom: 0;
}
#contents > *.active {
    display: block;
}
`;

export default class extends HTMLElement {
    constructor() {
        super();
        // === Build shadow dom ===
        const shadow = this.attachShadow({ mode: "open"});
        this.stylesheet = document.createElement("style");
        this.stylesheet.append(css);
        this.tabs = document.createElement("div");
        this.tabs.id = "tabs";
        this.tabs.setAttribute("part", "tab-bar");
        // Fetches the content and moves it under us in the right position.
        this.tabs.ondrop = this.onTabDrop;
        // Enable visual feedback for the drop zone
        this.tabs.ondragenter = ev => addPart(this.tabs, "dragover");
        this.tabs.ondragexit = ev => removePart(this.tabs, "dragover");
        // Allow browser-specific feedback
        this.tabs.ondragover = ev => {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
        }
        this.contents = document.createElement("slot");
        shadow.append(this.stylesheet, this.tabs, this.contents);
        
        // === Observer ===
        this.content_watcher = new MutationObserver(this.initWatcherAndTabs.bind(this));
        this.initWatcherAndTabs();
    }

    /** @param {DragEvent} ev */
    onTabGrab(ev) {
        // Get the uid
        const content = this.getContentForTab(ev.currentTarget);
        var uid = content.getAttribute("data-uid");
        if (uid === null) {
            uid = getUid();
            content.setAttribute("data-uid", uid);
        }
        // Send the uid with the drag event
        ev.dataTransfer.setData("tabs/uid", uid);
        this.dispatchEvent(new CustomEvent("tabdragstart", {
            bubbles: true,
            detail: { uid }
        }));
    };

    /** @param {DragEvent} ev */
    onTabDrop(ev) {
        // Get the tab UID. Also ensure that the dragged thing is a tab.
        const uid = ev.dataTransfer.getData("tabs/uid");
        if (!uid) return;

        // Accept the event and find special elements
        ev.preventDefault();
        /** @type {Element} */
        const tabs = ev.currentTarget;
        const host = tabs.getRootNode().host;
        removePart(tabs, "dragover");

        // Get the dragged content element
        const content = document.querySelector(`[data-uid="${uid}"]`);

        // Get the index at which it is to be inserted
        var i = 0;
        while (i < tabs.childElementCount &&          // While there is still a child and
               tabs.children[i] != ev.target &&       // neither is child the drop target
               !tabs.children[i].contains(ev.target)) // nor does child contain it,
            i++;                                      // increment the index
        
        // Insert the content
        host.insertBefore(content, host.children[i]);
        // Select this tab after the tab-bar had been updated
        setTimeout(() => host.selectTab(content), 0);
    }

    onContainerEmpty() {
        this.dispatchEvent(new CustomEvent("empty", {
            bubbles: true
        }));
    }

    getTabFromArg(arg) {
        // If it's an index, select the nth tab.
        if (typeof arg == "number") {
            arg = this.tabs.children[arg];
            if (!arg)
                throw new RangeError("Tab index out of range");
        }
        // If it's a content, change to the relevant tab
        else if (arg.parentElement == this) {
            var handle = this.tabs.firstElementChild;
            while (arg = arg.previousElementSibling)
                handle = handle.nextElementSibling;
            arg = handle;
        }
        // If it's null or undefined, throw
        else if (!arg) 
            throw new RangeError("Can't select null");
        return arg;
    }

    selectTab(tab) {
        tab = this.getTabFromArg(tab);
        removePart(this.tabs.querySelector(`[part~="active"]`), "active");
        this.querySelector(`[active]`)?.removeAttribute("active");
        addPart(tab, "active");
        this.getContentForTab(tab).setAttribute("active", "active");
    }

    closeTab(tab) {
        tab = this.getTabFromArg(tab);
        this.getContentForTab(tab).remove();
    }

    getContentForTab(tab) {
        const idx = Array.prototype.indexOf.call(this.tabs.children, tab);
        return this.children[idx];
    }

    initWatcherAndTabs() {
        // Completely redraw the tab bar and reconfigure the observer, to prevent watching moved tabs.
        this.tabs.innerHTML = "";
        this.content_watcher.disconnect();
        this.content_watcher.observe(this, { childList: true});
        var shouldSelectFirst = true;
        if (this.childElementCount == 0) {
            this.onContainerEmpty();
            shouldSelectFirst = false;
        }
        for (const child of this.children) {
            this.constructTab(child);
            this.content_watcher.observe(child, { 
                attributes: true, 
                attributeFilter: ["data-title"] 
            });
            if (child.hasAttribute("active")) 
                shouldSelectFirst = false;
        }
        if (shouldSelectFirst) this.selectTab(0);
    }

    constructTab(content) {
        // Ensure the thing has a uid.
        content.setAttribute("data-uid", getUid());
        
        // === Build HTML ===
        const tab = document.createElement("span");
        tab.textContent = content.getAttribute("data-title");
        tab.setAttribute("part", "tab");
        if (content.getAttribute("active")) addPart(tab, "active");
        tab.setAttribute("draggable", "true");
        this.shadowRoot.getElementById("tabs").append(tab);
        tab.onclick = ev => {
            ev.stopPropagation();
            const host = ev.currentTarget.getRootNode().host;
            host.selectTab(ev.currentTarget);
        };
        
        // === Drag events ===
        tab.ondragstart = this.onTabGrab.bind(this);
        // Catch these so they don't bubble to the tab-bar.
        tab.ondragenter = ev => {
            ev.stopPropagation();
            addPart(ev.currentTarget, "dragover");
        };
        tab.ondragexit = ev => {
            ev.stopPropagation();
            removePart(ev.currentTarget, "dragover");
        };
        
        // === Close button ===
        const close = document.createElement("i");
        close.setAttribute("part", "close");
        tab.append(close);
        close.onclick = ev => {
            ev.stopPropagation();
            const host = ev.currentTarget.getRootNode().host
            host.closeTab(ev.currentTarget);
        };
    }
}