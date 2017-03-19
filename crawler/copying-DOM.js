// Module containing functions executed in browser's javascript context

// ====================================================================================================================
function GenerateDOMCopy(yieldTreeNodes, getDomNodeDraft, checkNodeIsBlacklisted, getPropertiesOfDOMnode) {
    // All function prameters are strings
    
    // converting string to function
    eval(yieldTreeNodes);
    eval(getDomNodeDraft);
    eval(checkNodeIsBlacklisted);
    eval(getPropertiesOfDOMnode);
    // converting string to class
    // DOMmodel = (new Function(DOMmodel + "; return DOMmodel;"))();

    // ================================================================================================================
    let rootDOMnode = document.getElementsByTagName('body')[0];

    let domModel = getDomNodeDraft();
    let domModelStack = [domModel];

    function* yieldNodeChilds (node) {
        for (let child of node.children)
            yield child;
    }

    for (let {node, levelChange} of yieldTreeNodes(rootDOMnode, yieldNodeChilds, 't')) {

        if (levelChange <= 0)
            for (let i = 0; i < -levelChange +1; i++)
                domModelStack.pop();

        let newNode = getDomNodeDraft();
        ({clickables: newNode.clickables, props: newNode.props} = getPropertiesOfDOMnode(node));
        domModelStack[domModelStack.length -1].childNodes.push(newNode);
        domModelStack.push(newNode);
    }

    return {
        url: document.location.href,
        domSnapshot: domModel.childNodes[0]
    };
};

// ====================================================================================================================

module.exports.GenerateDOMCopy = GenerateDOMCopy;
