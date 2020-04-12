import { hasPart } from "./parts.mjs";
import { addPart } from "./parts.mjs";
import { removePart } from "./parts.mjs";

export function setModulePath(path)
{
    module_path = path;
}
var module_path = ".";

/** 
 * @type {HTMLElement}
 * @private @global
 */
var dragged;

export default class extends HTMLElement
{
    constructor()
    {
        const self = super();
        this.next_id = 0;
        // === Build shadow tree ===
        const shadow = this.attachShadow({ mode: "open" });
        const style = document.createElement("link");
        style.rel = "stylesheet";
        style.type = "text/css";
        style.href = module_path + "/tabs.css";
        const root = document.createElement("div");
        root.id = "shadow-top";
        const tabs = document.createElement("div");
        tabs.id = "tabs";
        tabs.setAttribute("part", "tab-bar");
        tabs.ondrop = async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            removePart(tabs, "dragover");
            if (!dragged) return;
            const new_tab = await getDroppedTab(tabs);
            new_tab.remove();
            tabs.append(new_tab);
        }
        tabs.ondragenter = ev => addPart(tabs, "dragover") || false;
        tabs.ondragexit = ev => removePart(tabs, "dragover");
        tabs.ondragover = () => false;
        const contents = document.createElement("div");
        contents.id = "contents";
        contents.setAttribute("part", "contents");
        root.append(tabs, contents)
        shadow.append(style, root);
        // === Register all children ===
        for (let child of this.childNodes)
        {
            if (!(child instanceof HTMLElement)) continue;
            this.registerContent(child);
        }
        // === Watch the tree ===
        const tree_watcher = new MutationObserver(x => {
            x.forEach(change => {
                if (change.type == "childList") this.nodeListChanged(change);
            })
        });
        tree_watcher.observe(this, { childList: true });
        return self;
    }

    /** @param {MutationRecord} change */
    nodeListChanged(change)
    {
        if (change.removedNodes.length > 0)
        {
            const contents = this.shadowRoot.getElementById("contents");
            const shadow_top = this.shadowRoot.getElementById("shadow-top");
            contents.childNodes.forEach(node => {
                if (!(node instanceof HTMLElement)) return;
                const uid = node.getAttribute("name");
                const content_selector = `[slot="${uid}"]`;
                if (!this.querySelector(content_selector))
                {
                    const related = shadow_top.getElementsByClassName(uid);
                    while (0 < related.length) related[0].remove();
                }
                if (!this.hasFocus())
                    this.selectTab();
            });
        }
        change.addedNodes.forEach(node => {
            if (node instanceof HTMLElement) this.registerContent(node);
        });
    }

    /** @param {HTMLElement} content */
    registerContent(content)
    {
        const uid = "uid-" + this.next_id++;
        //#region Build html
        const tab = document.createElement("span");
        tab.textContent = content.getAttribute("tab-name");
        tab.classList.add(uid);
        tab.setAttribute("data-uid", uid);
        tab.setAttribute("part", "tab");
        tab.setAttribute("draggable", "true");
        this.shadowRoot.getElementById("tabs").append(tab);
        const label = document.createElement("span");
        tab.append(label);
        tab.onclick = ev => {
            ev.stopPropagation();
            this.selectTab(uid);
        };
        //#endregion
        //#region Drag events
        tab.ondragstart = ev => {
            ev.stopPropagation();
            dragged = tab;
        };
        tab.ondrop = async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            removePart(tab, "dragover");
            if (tab == dragged) return;
            const new_tab = await getDroppedTab(tab);
            new_tab.remove();
            tab.insertAdjacentElement("beforebegin", new_tab);
        };
        tab.ondragenter = ev => {
            ev.stopPropagation();
            addPart(tab, "dragover");
            return false;
        };
        tab.ondragexit = ev => {
            ev.stopPropagation();
            removePart(tab, "dragover");
        };
        tab.ondragover = () => false;
        //#endregion
        //#region Close button
        const close = document.createElement("i");
        close.setAttribute("part", "close");
        tab.append(close);
        close.onclick = ev => {
            ev.stopPropagation();
            content.remove()
        };
        //#endregion
        // === Watch for name changes ===
        const name_watcher = new MutationObserver(x => {
            label.textContent = content.getAttribute("tab-name");
        });
        name_watcher.observe(content, {
            attributes: true, 
            attributeFilter: ["tab-name"]
        });
        // === Create and connect slot ===
        content.setAttribute("slot", uid);
        const slot = document.createElement("slot");
        slot.name = uid;
        slot.classList.add(uid);
        this.shadowRoot.getElementById("contents").append(slot);
        // === Select newly added tab if there wasn't a selected one already ===
        if (!this.hasFocus())
            this.selectTab(uid);
    }

    /** @returns {Boolean} */
    hasFocus()
    {
        const shadow_top = this.shadowRoot.getElementById("shadow-top");
        return shadow_top.getElementsByClassName("active").length > 0;
    }

    selectTab(uid = "")
    {
        if (!uid) 
        {
            const root = this.shadowRoot.getElementById("shadow-top");
            const first_slot = root.getElementsByTagName("slot")[0];
            // Select the first tab
            if (!first_slot) return; // If the container isn't empty
            uid = first_slot.name;
        }
        const root = this.shadowRoot.getElementById("shadow-top");
        const active = root.getElementsByClassName("active");
        while (0 < active.length) 
        {
            if (hasPart(active[0], "tab")) 
            {
                removePart(active[0], "active");
                const close = active[0].getElementsByTagName("i")[0];
                removePart(close, "active");
            }
            active[0].classList.remove("active");
        }
        const related = root.getElementsByClassName(uid);
        for (let i = 0; i < related.length; i++) 
        {
            if (hasPart(related[i], "tab")) 
            {
                addPart(related[i], "active");
                const close = related[i].getElementsByTagName("i")[0];
                addPart(close, "active");
            }
            related[i].classList.add("active");
        }
    }
}

/**
 * Handle the case where the user moved the tab to a different container
 * @param {HTMLElement} drop_target 
 * @returns {Promise<HTMLElement>}
 * @async
 */
function getDroppedTab(drop_target)
{
    return new Promise(resolve => {
        // If it was local
        if (dragged.getRootNode() == drop_target.getRootNode()) 
        {
            // Just reset dragged and return it
            const target = dragged;
            dragged = null;
            resolve(target);
        }
        // If it was across containers
        else
        {
            // Get the content
            /** @type {HTMLElement} */
            const original_container = dragged.getRootNode().host;
            const original_uid = dragged.getAttribute("data-uid");
            const content_selector = `[slot="${original_uid}"]`;
            const content = original_container.querySelector(content_selector);
            // Move the content
            content.remove();
            drop_target.getRootNode().host.append(content);
            // Wait for the new grid to handle the move event
            setTimeout(() => {
                // Forget the old tab
                dragged.remove();
                dragged = null;
                // Get the new tab
                const new_uid = content.getAttribute("slot");
                /** @type {ShadowRoot} */
                const new_shadowroot = drop_target.getRootNode();
                const tab_selector = `[data-uid="${new_uid}"]`;
                const new_tab = new_shadowroot.querySelector(tab_selector);
                // Resolve with the new tab
                resolve(new_tab);
            }, 10);
        }
    });
}