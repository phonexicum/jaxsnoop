'use strict';

// ====================================================================================================================
// Includes & Setup

const assert = require('assert');
const deepcopy = require('deepcopy');

// ====================================================================================================================
class DOMmodel {
    constructor(url = null, domSnapshot = null){

        this.url = url;
        this.domSnapshot = domSnapshot;
    }

    // ================================================================================================================
    static getDomNodeDraft(){
        return {
            tagName: null,
            attributes: [],
            nodeValues: null,
            childNodes: []
        };
    }

    // ================================================================================================================
    static compareNodes(n1, n2){
        try {
            assert(n1.tagName === n2.tagName);
            assert.deepStrictEqual(n1.clickables, n2.clickables);
            assert.deepStrictEqual(n1.attributes, n2.attributes);
            // assert.deepStrictEqual(n1.nodeValues, n2.nodeValues);
        } catch (err) {
            if (err.name === 'Assertion Error')
                return false;
            else
                throw err;
        }
        return true;
    }

    // ================================================================================================================
    // Function converting domModel into html-string
    rebuildDom(domModel = this.domSnapshot, level = 0) {

        let dom = '';
        dom += ' '.repeat(level) + '<' + domModel.tagName + ' ';
        for (let attr of domModel.attributes)
            dom += attr.attrName + '="' + attr.attrValue + '" ';
        
        dom += 'clickables="' + domModel.clickables.join(' ') + '"';
        dom += '>\n';

        // node text
        if (domModel.nodeValues.length > 0)
            dom += ' '.repeat(level + 4) + domModel.nodeValues.join(' ') + '\n';

        if (domModel.childNodes !== null)
            for (let child of domModel.childNodes)
                dom += this.rebuildDom(child, level + 4);

        dom += ' '.repeat(level) + '</' + domModel.tagName + '>\n';
        return dom;
    }

    // ================================================================================================================
}

// ====================================================================================================================
class WebAppModel {
    constructor() {

        this.ctrlTemplates = [];
        this.newTemplates = [];
        this.webappStateModel = {};
        this.knownUrls = [];
    }

    // ================================================================================================================
    // Function compares two DOM models, extracts templates from first one and returns decomposed DOM model and detected templates
    addDomModel(domModel, tmplModel) {

        // function must detect similarities:
        //      1) similarities on one page (e.g. two forums on one webpage; crawler must be interested to crawl only one of them)
        //      2) similar pages (e.g. habrahabr articles of different users)
        //      3) similarities between pages (e.g. status bar (login, logout, settings, etc))
        
        // ordered trees

        let selfDetecting = domModel === tmplModel;
        let tmplModel2 = deepcopy(tmplModel);
        let domModel2 = deepcopy(domModel);

        function* yieldNodeChilds(node){
            for (let child of node.childNodes)
                yield child;
        }

        

        for (let tmplCurRoot of utils.yieldTreeNodes(tmplModel, yieldNodeChilds)) {
        for (let domCurRoot of utils.yieldTreeNodes(domModel, yieldNodeChilds)) {

        }
        }

        let i_color = 0;
        for (let tmplCurRoot of utils.yieldTreeNodes(tmplModel, yieldNodeChilds)) {
        for (let domCurRoot of utils.yieldTreeNodes(domModel, yieldNodeChilds)) {
        if (//(selfDetecting !== true || tmplCurRoot !== domCurRoot) &&
            compareNodes(tmplCurRoot, domCurRoot) === true) {

            i_color ++;

            let tmplSubTreeGen = utils.yieldTreeNodes(tmplCurRoot, yieldNodeChilds);
            let domSubTreeGen = utils.yieldTreeNodes(domCurRoot, yieldNodeChilds);

            let {node: i_tmplNode, levelChange: i_tmplLevelChange} = tmplSubTreeGen.next().value;
            let {node: i_domNode, levelChange: i_domLevelChange} = domSubTreeGen.next().value;
            let shiftDom_i = false;
            let shiftTmpl_i = false;
            let domLevel = i_domLevelChange;
            let tmplLevel = i_tmplLevelChange;
            let match = false;

            let nodePairs = [];

            let stackDOMreconstruction = [];

            while (true) {
                if (shiftDom_i === false && shiftTmpl_i === false)
                    if (domLevel === tmplLevel && compareNodes(i_domNode, i_tmplNode) === true) {

                        nodePairs.push({
                            tmplNode: i_tmplNode,
                            domNode: i_domNode,
                            levelChange: domLevel - stackDOMreconstruction.length
                        });

                        while (stackDOMreconstruction.length >= domLevel)
                            stackDOMreconstruction.pop();
                        stackDOMreconstruction.push(i_domNode);

                        shiftDom_i = true;
                        shiftTmpl_i = true;
                        match = true;
                    } else {
                        shiftDom_i = true;
                    }
                
                if (shiftTmpl_i === true) {
                    let value, done;
                    if (match) {
                        ({value, done} = tmplSubTreeGen.next());
                        // match = false; // no! match will be falsed after domNode shifting below
                    } else {
                        ({value, done} = tmplSubTreeGen.next(false));
                    }
                    if (done === false) {
                        ({node: i_tmplNode, levelChange: i_tmplLevelChange} = value);
                        tmplLevel += i_tmplLevelChange;

                        shiftTmpl_i = false;
                    } else {
                        break;
                    }
                }

                if (shiftDom_i === true) {
                    let value, done;
                    if (match) {
                        ({value, done} = domSubTreeGen.next());
                        match = false;
                    } else {
                        ({value, done} = domSubTreeGen.next(false));
                    }
                    if (done === false) {
                        ({node: i_domNode, levelChange: i_domLevelChange} = value);
                        domLevel += i_domLevelChange;

                        if (domLevel < tmplLevel) {
                            shiftTmpl_i = true;
                        } else if (domLevel > tmplLevel) {
                            shiftDom_i = true;
                        } else {
                            shiftDom_i = false;
                        }

                    } else {
                        shiftDom_i = true;
                        shiftTmpl_i = true;

                        domSubTreeGen = utils.yieldTreeNodes(domCurRoot, yieldNodeChilds, 't', stackDOMreconstruction);
                        domLevel = 0;
                    }
                }
            }

            if (nodePairs.length >= 5){
                for (let pair of nodePairs) {
                    pair.tmplNode.correlation.push(pair.domNode);
                    pair.domNode.correlation.push(pair.tmplNode);
                    pair.tmplNode.color.push(i_color);
                    pair.domNode.color.push(i_color);
                }
            }

        }}}

    }

    // ================================================================================================================
}

module.exports = {
    DOMmodel: DOMmodel,
    WebAppModel: WebAppModel
};
