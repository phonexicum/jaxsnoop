'use strict';

// ====================================================================================================================
// Includes & Setup
const assert = require('assert');
const levenshtein = require('../utils/levenshtein.js');

// ====================================================================================================================
// Check if DOM node is blacklisted and must not be added into model (global objects must not be used)
function checkNodeIsBlacklisted(node) {

    // This array contains several functions each checking if the node must be ignored
    let nodeBlacklist = [
        node => {
            // Check if element is hidden https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
            return node.offsetParent === null; // node.hidden === true || node.style.display === 'none'
        },
        node => {
            return node.nodeName === '#text';
        },
        node => {
            return node.nodeName === 'SCRIPT';
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
    let nodeClickablesOfInterest = ['onclick'];

    // ================================================================================================================
    let properties = {};
    for (let property in nodePropertiesOfInterest) {
        if (nodePropertiesOfInterest.hasOwnProperty(property)) {
            properties[property] = nodePropertiesOfInterest[property](currentNode);
        }
    }

    let clickables = [];
    for (let clickable of nodeClickablesOfInterest) {
        if (currentNode[clickable] !== null) {
            clickables.push(clickable);
        }
    }

    return {
        props: properties,
        clickables: clickables
    };
}

// ====================================================================================================================
function stringifyNodeBeginning(node, level = 0, tabulation = 4) {

    let str = '';
    str += ' '.repeat(level*tabulation) + '<' + node.props.tagName + ' ';
    for (let attr of node.props.attributes)
        str += attr.attrName + '="' + attr.attrValue + '" ';
    
    str += 'clickables="' + node.clickables.join(' ') + '"';
    str += '>\n';

    if (node.props.nodeValues.length > 0)
        str += ' '.repeat((level +1)*tabulation) + node.props.nodeValues.join(' ') + '\n';

    return str;
}

function stringifyNodeEnding(node, level = 0, tabulation = 4) {
    return ' '.repeat(level*tabulation) + '</' + node.props.tagName + '>\n';
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
    if (! n1.clickables.every((val, i) => val === n2.clickables[i]))
        return false;

    return true;
}

// ====================================================================================================================
module.exports = {
    checkNodeIsBlacklisted: checkNodeIsBlacklisted,
    getPropertiesOfDOMnode: getPropertiesOfDOMnode,
    stringifyNodeBeginning: stringifyNodeBeginning,
    stringifyNodeEnding: stringifyNodeEnding,
    compareNodes: compareNodes
};
