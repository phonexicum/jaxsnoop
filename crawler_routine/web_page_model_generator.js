// Module containing function for web-page DOM analysis and generating its tree model with marks of interested clickables
//
// Execution context: slimerjs

// This function execution context: web-page
// 
// this function must generate some tree-object which will reflect DOM-tree and possible user-actions
//  
module.exports.GenerateWebPageModel = function GenerateWebPageModel() {

    // ================================================================================================================
    // This array contains several functions each checking if the node must not be ignored
    var nodeBlacklist = [
        (node) => {
            return node.hidden === true;
        },
        (node) => {
            return node.nodeName === "#text";
        }
    ];
    function checkNodeIsBlacklisted (node) {
        return ! nodeBlacklist.every((val, i, arr) => {
            return ! val(node);
        });
    }

    // ================================================================================================================
    // This object contains pairs of nodeModel property and function which return the value that is going to be saved into DOM tree model (function gets pointer to DOM node of web-page).
    var nodePropertiesOfInterest = {
        "tagName": (node) => { 
            // returns tagName string

            return node.nodeName;
        },

        "attributes": (node) => {
            // returns array of dictionaries representing node attributes

            var attributes = [];
            for (var attr of node.attributes)
            {
                attributes.push({
                    attrName: attr.nodeName,
                    attrValue: attr.nodeValue
                });
            }
            return attributes;
        },

        "nodeValues": (node) => {
            // returns array of "#text" childNodes .nodeValue
            
            var nodeValues = [];
            for (var subnode of node.childNodes) {
                if (subnode.nodeName == "#text" && ! /^\s*$/g.test(subnode.nodeValue)) {
                    nodeValues.push(subnode.nodeValue);
                }
            }
            return nodeValues;
        }
    };

    // ================================================================================================================
    // Names of clickables, which has to be memorized if they are available.
    var nodeClickablesOfInterest = ["onclick"];

    // ================================================================================================================
    // Function for making model from DOM node
    // 
    function MakingDOMcopyOnModel (currentNode, currentNodeModel) {

        currentNodeModel.clickables = [];

        for (var property in nodePropertiesOfInterest) {
            if (nodePropertiesOfInterest.hasOwnProperty(property)) {
                currentNodeModel[property] = nodePropertiesOfInterest[property](currentNode);
            }
        }

        for (var clickable of nodeClickablesOfInterest) {
            if (currentNode[clickable] !== null) {
                currentNodeModel.clickables.push(clickable);
            }
        }
    }

    // ================================================================================================================
    function main () {

        var rootNode = document.getElementsByTagName('body')[0];
        var currentNode = rootNode;

        var domTreeModelRoot = { // each tree node is dictionary with array of child-nodes
            childNodes: null
        };
        var domTreeModelPointer = domTreeModelRoot;
        var domTreeModelPointerStack = [];

        // In this cycle algorithm is walking through DOM tree depth-first with regard to checkNodeIsBlacklisted
        while (true){

            MakingDOMcopyOnModel (currentNode, domTreeModelPointer);
            
            var blacklistCheckedNode = null;

            /* If we have childNodes and this is not the first time we analyze this node (we have never before investigted its children) */
            if (currentNode.children.length > 0 && domTreeModelPointer.childNodes === null) {

                for (var node of currentNode.children) {
                    if (checkNodeIsBlacklisted(node) === false) {
                        blacklistCheckedNode = node;
                        break;
                    }
                }
                
                if (blacklistCheckedNode !== null) {
                    currentNode = blacklistCheckedNode;
                    domTreeModelPointer.childNodes = [{
                        childNodes: null
                    }];
                    domTreeModelPointerStack.push(domTreeModelPointer);
                    domTreeModelPointer = domTreeModelPointer.childNodes[0];
                    continue;
                }
            }

            /* If we have sibling node */
            if (currentNode.nextElementSibling !== null) {

                var nextSibling = currentNode.nextElementSibling;
                while (nextSibling !== null) {
                    if (checkNodeIsBlacklisted(currentNode.nextElementSibling) === false) {
                        blacklistCheckedNode = nextSibling;
                        break;
                    }
                    nextSibling = nextSibling.nextElementSibling;
                }
                if (blacklistCheckedNode !== null) {
                    currentNode = blacklistCheckedNode;
                    var parentNode = domTreeModelPointerStack[domTreeModelPointerStack.length -1];
                    var newDOMTreeModelNode = {
                        childNodes: null
                    };
                    parentNode.childNodes.push(newDOMTreeModelNode);
                    domTreeModelPointer = newDOMTreeModelNode;
                    continue;
                }

            } 

            currentNode = currentNode.parentNode;
            /* If we have not parent node */
            if (domTreeModelPointerStack.length === 0) break;
            domTreeModelPointer = domTreeModelPointerStack.pop();
        }
        domTreeModelPointer = domTreeModelRoot;

        return JSON.stringify(domTreeModelRoot);
    }

    return main();
};
