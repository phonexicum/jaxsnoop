// Module containing functions executed in browser's javascript context

// ====================================================================================================================
function generateDOMCopy(yieldTreeNodes, getDomNodeDraft, checkNodeIsBlacklisted, getPropertiesOfDOMnode) {
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
            if (checkNodeIsBlacklisted(child) === false)
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

    // JSON.strinfigy must be used explicitly because alternative used by selenium to pass objects between JS executable contexts will broke
    //  'undefined' values and replace them with 'null' value
    return JSON.stringify({
        url: document.location.href,
        domSnapshot: domModel.childNodes[0]
    });
};

// ====================================================================================================================
// get css pointing at some element in web-form, which is going to be executed
//  fillingValue - some big integer, been treated as string to fill values
//  return - how much to add to fillingValue after this function was run
//
function fillTheForm(css, fillingValue) {
    let fillingValueAdd = 0;

    let elem = document.querySelector(css);
    let form = elem.form;
    if (form !== undefined) {
        for (let elem of form.getElementsByTagName('textarea')) {
            elem.value = '' + fillingValue++;
            fillingValueAdd++;
        }
        for (let elem of form.querySelectorAll('input[type=text]')) {
            elem.value = '' + fillingValue++;
            fillingValueAdd++;
        }
        // for (let elem of form.querySelectorAll('input[type=checkbox]'))
        //     elem.checked = true;
        // for (let elem of form.querySelectorAll('input[type=radio]').reverse())
        //     elem.checked = true;
    }
    return fillingValueAdd;
}

// ====================================================================================================================

module.exports = {
    generateDOMCopy: generateDOMCopy,
    fillTheForm: fillTheForm
};
