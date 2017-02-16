// Module containing functions executed in browser's javascript context

// ====================================================================================================================
function GenerateDOMCopy(yieldTreeNodes) {
    
    eval(yieldTreeNodes); // converting string to function

    // ================================================================================================================
    // This array contains several functions each checking if the node must be ignored
    
    let nodeBlacklist = [
        node => {
            // Check if element is hidden https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
            return node.offsetParent === null; // node.hidden === true || node.style.display === 'none'
        },
        node => {
            return node.nodeName === "#text";
        }
    ];
    function checkNodeIsBlacklisted(node) {
        return nodeBlacklist.some(val => val(node));
    }

    // ================================================================================================================
    // This object contains pairs of nodeModel property and function which return the value that is going to be saved into DOM tree model
    //      (function gets pointer to DOM node of webpage).
    
    let nodePropertiesOfInterest = {
        tagName: node => { 
            // returns tagName string
            return node.nodeName.toLowerCase();
        },

        attributes: node => {
            // returns array of dictionaries representing node attributes

            let attributes = [];
            for (let attr of node.attributes)
            {
                attributes.push({
                    attrName: attr.nodeName,
                    attrValue: attr.nodeValue
                });
            }
            return attributes;
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
    
    let nodeClickablesOfInterest = ["onclick"];

    // ================================================================================================================
    // Function for making model from DOM node
    
    function MakingDOMcopyOnModel(currentNode, currentNodeModel) {

        for (let property in nodePropertiesOfInterest) {
            if (nodePropertiesOfInterest.hasOwnProperty(property)) {
                currentNodeModel[property] = nodePropertiesOfInterest[property](currentNode);
            }
        }

        currentNodeModel.clickables = [];

        for (let clickable of nodeClickablesOfInterest) {
            if (currentNode[clickable] !== null) {
                currentNodeModel.clickables.push(clickable);
            }
        }
    }

    // ================================================================================================================
    function main() {

        let rootDOMnode = document.getElementsByTagName('body')[0];

        let domModel = {
            childNodes: []
        };
        let domModelStack = [domModel];

        function* yieldNodeChilds (node) {
            for (let child of node.children)
                yield child;
        }

        for (let {node, levelChange} of yieldTreeNodes(rootDOMnode, yieldNodeChilds, 't')) {

            if (levelChange <= 0)
                for (let i = 0; i < -levelChange +1; i++)
                    domModelStack.pop();

            let newNode = {childNodes: []};
            MakingDOMcopyOnModel (node, newNode);
            domModelStack[domModelStack.length -1].childNodes.push(newNode);
            domModelStack.push(newNode);
        }

        return {
            url: document.location.href,
            domSnapshot: domModel.childNodes[0]
        };
    }

    return main();
};

// ====================================================================================================================

module.exports.GenerateDOMCopy = GenerateDOMCopy;
