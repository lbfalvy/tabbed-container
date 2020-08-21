/**
 * Check whether an element has a given part
 * @param {HTMLElement} element 
 * @param {String} part 
 * @returns {Boolean}
 */
export function hasPart(element, part)
{
    const attr = element?.getAttribute("part");
    return attr != null && attr.split(" ").includes(part);
}

/**
 * Append a part to an element's part attribute
 * @param {HTMLElement} element 
 * @param {String} part 
 * @private
 */
function unsafeAddPart(element, part)
{
    var part_attr = element.getAttribute( "part" );
    element.setAttribute( "part", part_attr.concat(" ", part) );
}

/**
 * @param {HTMLElement} element 
 * @param {String} part 
 */
export function addPart(element, part)
{
    if (!hasPart(element, part)) unsafeAddPart(element, part);
}

/**
 * @param {HTMLElement} element 
 * @param {String} part 
 */
export function removePart(element, part)
{
    if (!hasPart(element, part)) return;
    var part_attr = element.getAttribute("part");
    part_attr = part_attr.split(" ").filter(x => x != part).join(" ");
    element.setAttribute("part", part_attr);
}

/**
 * @param {HTMLElement} element 
 * @param {String} part 
 */
export function togglePart(element, part)
{
    if (hasPart(element, part)) removePart(element, part);
    else unsafeAddPart(element, part);
}