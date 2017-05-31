'use strict';

// ====================================================================================================================
// Includes & Setup
const assert = require('assert');
const levenshtein = require('../utils/levenshtein.js');

// ====================================================================================================================
// Check if DOM node is blacklisted and must not be added into model (global objects must not be used)
function checkNodeIsBlacklisted(node) {

    // This array contains several functions each checking if the node must be ignored
    //  ATTENTION: nodes must be blacklisted carefully, because it can break css navigation for finding
    //      clickables on opened webPage and click them
    let nodeBlacklist = [
        // node => {
        //     // Check if element is hidden https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
        //     return node.offsetParent === null; // node.hidden === true || node.style.display === 'none'
        // },
        node => {
            return node.nodeName === '#text';
        },
        node => {
            return node.nodeName === 'SCRIPT' || node.nodeName === 'BR';
        }
    ];
    
    return nodeBlacklist.some(val => val(node));
}

// ====================================================================================================================
// Making model from DOM node (global objects must not be used)
//  return object:
//      {   props: {...},
//          clickables: [...]   }
function getPropertiesOfDOMnode(currentNode) {

    // ================================================================================================================
    // This object contains pairs of nodeModel property and function which return the value that is going to be saved into DOM tree model
    let nodePropertiesOfInterest = {
        tagName: node => { 
            // returns tagName string
            return node.nodeName.toLowerCase();
        },

        attributes: node => {
            // returns array of dictionaries representing node attributes
            return Array.from(node.attributes, attr => {
                return {
                    attrName: attr.nodeName,
                    attrValue: attr.nodeValue
                };
            });
        },

        nodeValues: node => {
            // returns array of "#text" childNodes .nodeValue
            let nodeValues = [];
            for (let subnode of node.childNodes) {
                if (subnode.nodeName === '#text' && ! /^\s*$/g.test(subnode.nodeValue)) {
                    nodeValues.push(subnode.nodeValue.trim());
                }
            }
            return nodeValues;
        }
    };

    // ================================================================================================================
    // Names of clickables, which has to be memorized if they are available.
    let nodeClickablesOfInterest = ['skip-it-for-a-debugging-purposes onclick'];

    // ================================================================================================================
    let properties = {};
    for (let property in nodePropertiesOfInterest) {
        if (nodePropertiesOfInterest.hasOwnProperty(property)) {
            properties[property] = nodePropertiesOfInterest[property](currentNode);
        }
    }

    let clickables = [];
    
    // If element is hidden we must know about it for correct navigation, but its clickables must not be studyed

    // Check if element is hidden https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
    if (currentNode.offsetParent !== null && // node.hidden === true || node.style.display === 'none'
            // For Pyforum:
            (currentNode.title !== 'Logout' && currentNode.title !== 'Forum Administration')
        ) {
        
        for (let clickable of nodeClickablesOfInterest) {
            if (currentNode[clickable] !== undefined && currentNode[clickable] !== null) {
                clickables.push({
                    clk: clickable
                });
            }
        }
        if (properties.tagName === 'a')
            clickables.push({clk: 'a'});
        if (properties.tagName === 'input' && properties.attributes.some(val => val.attrName === 'type' && val.attrValue === 'submit'))
            clickables.push({clk: 'input_submit'});
    }

    return {
        props: properties,
        clickables: clickables
    };
}

// ====================================================================================================================
// Function for copying valuable model-related attributes from deletable node to other node
//  node clickable type can be 'g' (get), 'p' (post), 'd' (denial/forbidden)
function mergeEqualNodes(node, delNode) {

    for (let clickable of delNode.clickables) {
        let node_clk_i = node.clickables.findIndex(val => val.clk === clickable.clk);
        if (node_clk_i === -1)
            node.clickables.push(clickable);
        else {
            let users = Object.getOwnPropertyNames(clickable);
            users.splice(users.indexOf('clk'), 1);
            for (let user of users) {
                if (node.clickables[node_clk_i][user] === undefined) {
                    node.clickables[node_clk_i][user] = clickable[user];
                } else {

                    // Consistancy checks
                    if (node.clickables[node_clk_i][user].type  === 'g' || node.clickables[node_clk_i][user].type  === 'p' || node.clickables[node_clk_i][user].type  === 'd') {
                        if (node.clickables[node_clk_i][user].type !== clickable[user].type)
                            throw new Error ('The same clickable for the same user in different situations leads to different types of action. This is constraint for web-application. The model can not handle that. Can not merge nodes into single template: ' + nodeHandlers.stringifyNode(node) + ' ' + nodeHandlers.stringifyNode(delNode));
                    } else if (node.clickables[node_clk_i][user].type !== undefined)
                        throw new Error('Unknown choice.');

                    node.clickables[node_clk_i][user].type = clickable[user].type;
                    node.clickables[node_clk_i][user].webAppStates.push(...clickable[user].webAppStates);

                }
            }
        }
    }
}

// ====================================================================================================================
function stringifyNodeBeginning(node, level = 0, tabulation = 4, noNodeValues = false) {

    let str = '';
    str += ' '.repeat(level*tabulation) + '<' + node.props.tagName + ' ';
    for (let attr of node.props.attributes)
        str += attr.attrName + '="' + attr.attrValue + '" ';
    
    str += 'clickables="' + node.clickables.map(val => val.clk).join(' ') + '"';
    str += '>\n';

    if (!noNodeValues && node.props.nodeValues.length > 0)
        str += ' '.repeat((level +1)*tabulation) + node.props.nodeValues.join(' ') + '\n';

    return str;
}

function stringifyNodeEnding(node, level = 0, tabulation = 4) {
    return ' '.repeat(level*tabulation) + '</' + node.props.tagName + '>\n';
}

function stringifyNode(node) {
    return stringifyNodeBeginning(node, 0, 4, true).slice(0, -1) +
        node.props.nodeValues.join(' ') +
        stringifyNodeEnding(node).slice(0, -1);
}

// ====================================================================================================================
function compareNodes(n1, n2){

    if (n1.props.tagName !== n2.props.tagName)
        return false;
    
    let n2_attr_copy = n2.props.attributes.slice();

    // assert.deepStrictEqual(n1.props.attributes, n2.props.attributes);
    for (let attr1 of n1.props.attributes) {
        if (attr1.attrName === 'style')
            continue;
        else {
            let attr2_i = n2_attr_copy.findIndex(val => val.attrName === attr1.attrName);
            if (attr2_i === -1)
                return false;
            
            let attr2 = n2_attr_copy[attr2_i];
            n2_attr_copy.splice(attr2_i, 1);
            
            
            if (/^[\w\/-]*$/.test(attr1.attrValue) && /^[\w\/-]*$/.test(attr2.attrValue)) {
                if (attr1.attrValue === attr2.attrValue)
                    continue;
                else
                    return false;
            }

            let dist = levenshtein.getEditDistance(attr1.attrValue, attr2.attrValue);
            if (dist / ((attr1.attrValue.length + attr2.attrValue.length) / 2) > 0.10)
                return false;
        }
    }

    let i = n2_attr_copy.findIndex(val => val.attrName === 'style');
    if (i !== -1)
        n2_attr_copy.splice(i, 1);
    if (n2_attr_copy.length > 0)
        return false;

    // assert.deepStrictEqual(n1.props.nodeValues, n2.props.nodeValues);

    // assert.deepStrictEqual(n1.clickables, n2.clickables);
    let n1_clk = n1.clickables.map(val => val.clk);
    let n2_clk = n2.clickables.map(val => val.clk);
    if (n1_clk.length !== n2_clk.length ||
        ! n1_clk.every(val => n2_clk.indexOf(val) !== -1))
        return false;

    return true;
}

// ====================================================================================================================
function getNodeCssPresentation(node) {

    let importantAttributes = ['href', 'title', 'id'];

    let css_presentation = node.props.tagName;
    for (let {attrName, attrValue} of node.props.attributes) {
        if (importantAttributes.indexOf(attrName) !== -1)
            css_presentation += '[' + attrName + '="' + attrValue + '"]'
    }
    return css_presentation;
}

// ====================================================================================================================
module.exports = {
    checkNodeIsBlacklisted: checkNodeIsBlacklisted,
    getPropertiesOfDOMnode: getPropertiesOfDOMnode,
    mergeEqualNodes: mergeEqualNodes,
    stringifyNodeBeginning: stringifyNodeBeginning,
    stringifyNodeEnding: stringifyNodeEnding,
    stringifyNode: stringifyNode,
    compareNodes: compareNodes,
    getNodeCssPresentation: getNodeCssPresentation
};
