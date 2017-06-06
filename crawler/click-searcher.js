'use strict';

// ====================================================================================================================
const utils = require('../utils/utils.js');
const tmplModel = require('../model/tmpl-model.js');
const nodeHandlers = require('../model/node-handlers.js');

// ====================================================================================================================
class ClickSearcher {

    // ================================================================================================================
    // checkClickableFunc (node, clk_i) => boolean
    constructor(maxDepth, i_pstate, userName, checkClickableFunc) {
        
        this.maxDepth = maxDepth;
        this.userName = userName
        this.i_pstate = i_pstate;
        this.checkClickableFunc = checkClickableFunc;
            
        this.tmpls = new Set();
        this.webPageStack = [];
        this.browserPos = 0;
        this.browserTrace = false; // trace === false after back-off for depth first search

        // addWebPageAfterClickable(this.homePage);
    }

    // ================================================================================================================
    drop() {
        this.tmpls.clear();
        this.webPageStack = [];
        this.browserTrace = false;
    }

    // ================================================================================================================
    addWebPageAfterClickable(webPage) {
        let sp = {}; // sp - statePoint
        sp.webPage = webPage;
        sp.pageNodeStack = [];
        sp.pageIt = utils.yieldTreeNodes(sp.webPage.domRoot, tmplModel.NodeProcessing.getYieldNodeChilds('tmpl'));
        sp.tmpl = this._getNextUniqueTmplInWebPage(sp.pageIt, sp.pageNodeStack, this.tmpls);
        if (sp.tmpl === undefined) {
            // this.shiftToNextClickable();
            return undefined;
        }
        this.tmpls.add(sp.tmpl);
        sp.tmplNodeStack = [];
        sp.tmplIt = utils.yieldTreeNodes(sp.tmpl.tmplRoot, tmplModel.NodeProcessing.getYieldNodeChilds());
        sp.node = undefined;
        sp.clk_i = undefined;
        // ({node: sp.node, clk_i: sp.clk_i} = this._getNextGClickableInStack(sp.tmplIt, sp.tmplNodeStack));

        if (this.webPageStack.length < this.maxDepth) {
            this.webPageStack.push(sp);
            // this.shiftToNextClickable();
        }
    }

    // ================================================================================================================
    _genNextNode(gen, stack) {
        let {value, done} = gen.next();
        if (done !== true) {
            let {node, levelChange} = value;
            for (let i = 0; i < -levelChange +1; i++)
                stack.pop();
            stack.push(node);
            return node;
        } else {
            while (stack.length > 0)
                stack.pop();
            return undefined;
        }
    }

    // ================================================================================================================
    _getNextUniqueTmplInWebPage(gen, stack, tmpls) {
        while (true) {
            let node = this._genNextNode(gen, stack);
            if (node === undefined)
                return undefined;
            else if (node.type === 'tmpl' && tmpls.has(node.tmpl) === false)
                return node.tmpl;
        }
    }

    // ================================================================================================================
    _getNextGClickableInStack(gen, stack, fcheckClickable, node = undefined, clk_i = undefined) {

            if (node === undefined) {
                node = this._genNextNode(gen, stack);
                if (node === undefined)
                    return {node: undefined, clk_i: undefined};
                clk_i = undefined;
            }

            let i = 0; // skip clickables before clk_i
            if (clk_i !== undefined) {
                while (node.clickables[i].clk !== node.clickables[clk_i].clk)
                    i++;
                i++;
            }

            while (true) {
                while ( i < node.clickables.length && ! fcheckClickable(node, i))
                    i++;
                
                if (i >= node.clickables.length) {
                    node = this._genNextNode(gen, stack);
                    i = 0;
                    if (node === undefined)
                        return {node: undefined, clk_i: undefined};
                } else {
                    return {node, clk_i: i};
                }
            }
        }

    // ================================================================================================================
    shiftToNextClickable() {

        let checkCLickableWasClicked = (node, clk_i) =>
            node.clickables[clk_i] !== undefined &&
            node.clickables[clk_i][this.userName] !== undefined &&
            node.clickables[clk_i][this.userName].type === 'g' &&
            node.clickables[clk_i][this.userName].webAppStates.some(state => state.i_pstate === this.i_pstate);

        let findTargetOrGclkedNode = (node, clk_i) => this.checkClickableFunc(node, clk_i) || checkCLickableWasClicked(node, clk_i);

        // Current clickable will be shifted to next even if it is clicked g-clickable available to open recursively next web-page in webPageStack
        while (true) {

            if (this.webPageStack.length === 0)
                return; // Sorry, no clickable

            let sp = this.webPageStack[this.webPageStack.length -1]; // sp - statePoint

            ({node: sp.node, clk_i: sp.clk_i} = this._getNextGClickableInStack(sp.tmplIt, sp.tmplNodeStack, findTargetOrGclkedNode, sp.node, sp.clk_i));

            if (sp.node === undefined || sp.clk_i === undefined) {
                sp.tmpl = this._getNextUniqueTmplInWebPage(sp.pageIt, sp.pageNodeStack, this.tmpls);
                if (sp.tmpl !== undefined) {
                    this.tmpls.add(sp.tmpl);
                    if (sp.tmplNodeStack.length > 0)
                        throw new Error('tmplNodeStack is not cleared after previous steps, this must never happen!!!');
                    sp.tmplIt = utils.yieldTreeNodes(sp.tmpl.tmplRoot, tmplModel.NodeProcessing.getYieldNodeChilds());
                }
                else {
                    this.webPageStack.pop();
                    if (this.webPageStack.length -1 < this.browserPos)
                        this.trace = false;
                }
                continue;
            }

            if (this.checkClickableFunc(sp.node, sp.clk_i))
                return; // We found target clickable


            // We found g-clk
            let gclk = sp.node.clickables[sp.clk_i][this.userName];
            let webAppStatesPos = gclk.webAppStates.findIndex(state => state.i_pstate === this.i_pstate);
            if (webAppStatesPos === -1)
                throw new Error('webAppStatePos === -1, this must never happen!!!');
            this.addWebPageAfterClickable(gclk.webAppStates[webAppStatesPos].webPage);
        }
    }

    // ================================================================================================================
    *_getDomNodesToTheLeft(node) {
        // Check if we are not root node and if our parent is not template (because if it is - there is no garanties of children order)
        if (node.parent !== undefined && node.parent.type === undefined /* not 'tmpl' */) {
            let parent = node.parent;
            for (let child of parent.childNodes) {

                if (child === node)
                    break;

                if (child.type === undefined)
                    yield child;
                else if (child.type === 'tmpl')
                    yield child.tmpl.tmplRoot;
                else
                    throw new Error('Unknown choice.');
            }
        }
    }

    // ================================================================================================================
    getClickableCss(webPageStack_i) {

        if (webPageStack_i >= this.webPageStack.length)
            throw new Error('Illegal parameter');

        let sp = this.webPageStack[webPageStack_i];

        let css_selectors_stack = [];

        for (let i = 0; i < sp.pageNodeStack.length; i++) {
            let node = sp.pageNodeStack[i];
            let css_selector_shift = Array.from(this._getDomNodesToTheLeft(node)).map(lnode => lnode.props.tagName + ' ~ ').join('');

            if (node.type === undefined) {
                css_selectors_stack.push(css_selector_shift + nodeHandlers.getNodeCssPresentation(node));
            } else if (node.type === 'tmpl') {

                // get stack of nodes inside template
                let tmplNodeStack;
                if (i + 1 === sp.pageNodeStack.length)
                    tmplNodeStack = sp.tmplNodeStack;
                else {
                    tmplNodeStack = [];
                    let child = node.childNodes.find(child => child.child === sp.pageNodeStack[i+1]);
                    let tnode = child.tmplNode;
                    while (tnode.type === undefined) {
                        tmplNodeStack.unshift(tnode);
                        tnode = tnode.parent;
                    }
                }

                // get css inside template
                let css_tmpl_selectors_stack = [];
                for (let tnode of tmplNodeStack) {
                    let css_t_selector_shift = Array.from(this._getDomNodesToTheLeft(tnode)).map(lnode => lnode.props.tagName + ' ~ ').join('');
                    if (tnode.type !== undefined)
                        throw new Error('In template nodes must be only DOM nodes (type === undefined).');
                    css_tmpl_selectors_stack.push(css_t_selector_shift + nodeHandlers.getNodeCssPresentation(tnode));
                }

                css_selectors_stack.push(css_selector_shift + css_tmpl_selectors_stack.join(' > '));
            }
            else throw new Error('Unknown choice.');
        }
        return css_selectors_stack.join(' > ');
    }

    // ================================================================================================================
}

module.exports = {
    ClickSearcher: ClickSearcher
}
