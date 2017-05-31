'use strict';

// ====================================================================================================================
// Includes & Setup

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const utils = require('../utils/utils.js');
const nodeHandlers = require('./node-handlers.js');

// ====================================================================================================================
class NodeProcessing {
    // constructor(url = null, domSnapshot = null){

    //     this.url = url;
    //     this.domSnapshot = domSnapshot;
    // }

    // ================================================================================================================
    static getDomNodeDraft(){
        return {
            type: undefined,
            childNodes: [],
            parent: undefined, // Object
            clickables: undefined, // Array
            props: undefined, // Array
            tmplRoutine: {color: []} // tmplRoutine[color] = correlation;
        };
    }

    // ================================================================================================================
    static nullifyDomNode(node) {
        node.type = undefined;
        node.childNodes = [];
        node.parent = undefined;
        node.clickables = undefined;
        node.props = undefined;
        node.tmplRoutine = {color: []};
    }

    // ================================================================================================================
    static getYieldNodeChilds(...rest) {
        return function * (node) {
            if (node.type === undefined)
                for (let child of node.childNodes)
                    yield child;
            else if ((node.type === 'tmpl' && rest.indexOf('tmpl') !== -1))
                for (let child of node.childNodes)
                    yield child.child;
        }
    }

    // ================================================================================================================
    static compareNodes(n1, n2) {
        if (n1.type === undefined && n2.type === undefined)
            return nodeHandlers.compareNodes(n1, n2);
        else
            return false;
            // CONSEPTUAL: this is conceptual decision to never make any nodes, pointing to other tmpl, equal
            //  because it can cause serious difficulty:
            //      * tmpls can have lots of different sinks depeding on its parent dom, if new tmpl will be extracted from
            //          existing tmpls, there can be problems with storing those sinks in multi-tier structure (dom -> tmpl -> tmpl)
    }

    // ================================================================================================================
    // return boolean;
    static checkSubtreesPairToBeTmpl(equalNodesArr) {
        if (equalNodesArr.length >= NodeProcessing.minSize){
            return true;
        } else {
            return false;
        }
    }

    // ================================================================================================================
    // return boolean;
    static checkSubtreeHasClickable(subtree) {
        return subtree.some(val => (val.domNode.clickables.keys().length > 0 || val.domNode.props.tagName === 'a' || val.domNode.props.tagName === 'form'));
    }

    // ================================================================================================================
    // return boolean;
    static checkSubtreeArrToBeTmpl(subtreeArr) {
        if (subtreeArr.length >= NodeProcessing.minSize) {
            // Check if future template have any clickable, or there is no need to extract template
            return NodeProcessing.checkSubtreeHasClickable(subtreeArr);
        } else {
            return false;
        }
    }

    // ================================================================================================================
    // return boolean;
    static checkSubtreeToBeTmpl(tmpl) {
        let subtreeArr = Array.from(utils.yieldTreeNodes(tmpl, NodeProcessing.getYieldNodeChilds()));
        return NodeProcessing.checkSubtreeArrToBeTmpl(subtreeArr);
    }

    // ================================================================================================================
}

// NodeProcessing static variables
NodeProcessing.minSize = 4;

// ====================================================================================================================
class WebAppTmplModel extends EventEmitter {
    
    // function must detect similarities:
    //      1) similarities on one page (e.g. two forums on one webpage; crawler must be interested to crawl only one of them)
    //      2) similar pages (e.g. habrahabr articles of different users)
    //      3) similarities between pages (e.g. status bar (login, logout, settings, etc))
    
    constructor() {

        super();

        this.tmplCount = 1;
        this.webPageCount = 1;

        this.templates = []; // [{tmpl, tmplParents}, ...]
        // this.webAppGraph = undefined; // { domModel: {}, nextModels: [{}, ...] }
        this.webAppPageList = []; // [{domRoot: {}}, ...]

        this._init_addRoutine();
    }

    // ================================================================================================================
    _init_newWebPage(url, domModel) {
        return {
            name: this.webPageCount ++,
            type: 'webPage',
            url: url,
            domRoot: domModel
        };
    }
    // ================================================================================================================
    _init_newTmpl(tmplRoot, tmplParents) {
        return {
            name: this.tmplCount ++,
            type: 'template',
            tmplRoot: tmplRoot,
            tmplParents: tmplParents
        };
    }

    // ================================================================================================================
    _init_addRoutine() {
        this.addRoutine = {
            color: 0,
            colorCompliance: {} // colorCompliance[color] = {context, rootNode, pairColor}
        };
    }

    // ================================================================================================================
    _cleanup_addRoutine() {
        // Cleanup unused templates
        for (let tmpl_i = this.templates.length -1; tmpl_i >= 0; tmpl_i--) {
            if (this.templates[tmpl_i].tmplParents.length === 0) {
                delete this.templates[tmpl_i];
                this.templates.splice(tmpl_i, 1);
            }
        }

        this.addRoutine.color = 0;
        delete this.addRoutine.colorCompliance;
        this.addRoutine.colorCompliance = {};

        for (let tmpl of this.templates) {
            for (let node of utils.yieldTreeNodes(tmpl.tmplRoot, NodeProcessing.getYieldNodeChilds())) {
                delete node.tmplRoutine;
                node.tmplRoutine = {color:[]};
            }
        }
        
        let subPage_queue = [];
        this.webAppPageList.forEach(val => {
            subPage_queue.push(val.domRoot);
        });
        while (subPage_queue.length > 0) {
            for (let node of utils.yieldTreeNodes(subPage_queue.pop(), NodeProcessing.getYieldNodeChilds())) {
                if (node.type === 'tmpl')
                    node.childNodes.forEach(val => {
                        subPage_queue.push(val.child);
                    });
                delete node.tmplRoutine;
                node.tmplRoutine = {color:[]};
            }
        }
    }

    // ================================================================================================================
    // yield {
    //     domNode: ...,
    //     tmplNode: ...,
    //     levelChange: ...
    // };
    // 
    *_walkTwoTreesSynchronously(domTreeRoot, tmplTreeRoot, compareNodes, yieldNodeChilds) {

        let domTreeGen = utils.yieldTreeNodes(domTreeRoot, yieldNodeChilds);
        let tmplTreeGen = utils.yieldTreeNodes(tmplTreeRoot, yieldNodeChilds);

        let {node: i_domNode, levelChange: i_domLevelChange} = domTreeGen.next().value;
        let {node: i_tmplNode, levelChange: i_tmplLevelChange} = tmplTreeGen.next().value;
        let shiftDom_i = false;
        let shiftTmpl_i = false;
        let domLevel = i_domLevelChange;
        let tmplLevel = i_tmplLevelChange;
        let match = false;
        let tmplRecovery = false;
        let stackTmplReconstruction = [];

        while (true) {
            if (shiftDom_i === false && shiftTmpl_i === false)
                if (domLevel === tmplLevel && compareNodes(i_domNode, i_tmplNode) === true &&
                    i_domNode !== tmplTreeRoot  // CONSEPTUAL: if identical parts are searched in one domModel (e.g. domTreeRoot and tmplTreeRoot are from one tree) -
                                                //      identical parts under domTreeRoot and tmplTreeRoot must NOT overlap
                ) {

                    yield {
                        domNode: i_domNode,
                        tmplNode: i_tmplNode,
                        levelChange: domLevel - stackTmplReconstruction.length
                    };

                    while (stackTmplReconstruction.length >= tmplLevel)
                        stackTmplReconstruction.pop();
                    stackTmplReconstruction.push(i_tmplNode);

                    shiftDom_i = true;
                    shiftTmpl_i = true;
                    match = true;
                } else {
                    shiftTmpl_i = true;
                }
            
            if (shiftDom_i === true) {
                let value, done;
                if (match) {
                    ({value, done} = domTreeGen.next());
                    // match = false; // no! match will be falsed after tmplNode shifting below
                } else {
                    ({value, done} = domTreeGen.next(false));
                }
                if (done === false) {
                    ({node: i_domNode, levelChange: i_domLevelChange} = value);
                    domLevel += i_domLevelChange;

                    shiftDom_i = false;
                } else {
                    break;
                }
            }

            if (shiftTmpl_i === true) {
                let value, done;
                if (match || tmplRecovery) {
                    ({value, done} = tmplTreeGen.next());
                    match = false;
                    tmplRecovery = false;
                } else {
                    ({value, done} = tmplTreeGen.next(false));
                }
                if (done === false) {
                    ({node: i_tmplNode, levelChange: i_tmplLevelChange} = value);
                    tmplLevel += i_tmplLevelChange;

                    if (domLevel > tmplLevel) {
                        shiftDom_i = true;

                        tmplTreeGen = utils.yieldTreeNodes(tmplTreeRoot, yieldNodeChilds, 't', stackTmplReconstruction);
                        tmplLevel = 0;
                        tmplRecovery = true;
                        shiftTmpl_i = true;
                    } else if (domLevel < tmplLevel) {
                        shiftTmpl_i = true;
                    } else {
                        shiftTmpl_i = false;
                    }

                } else {
                    shiftDom_i = true;

                    tmplTreeGen = utils.yieldTreeNodes(tmplTreeRoot, yieldNodeChilds, 't', stackTmplReconstruction);
                    tmplLevel = 0;
                    tmplRecovery = true;
                    shiftTmpl_i = true;
                }
            }
        }
    }

    // ================================================================================================================
    // return [{domNode, tmplNode, levelChange}, ...] or undefined
    // 
    _getEqualSubRootPartsArr(domTreeRoot, tmplTreeRoot) {
        
        let equalNodesArr = [];
        for (let pair of this._walkTwoTreesSynchronously(domTreeRoot, tmplTreeRoot, NodeProcessing.compareNodes, NodeProcessing.getYieldNodeChilds()))
            equalNodesArr.push(pair);

        if (NodeProcessing.checkSubtreesPairToBeTmpl(equalNodesArr)) {
            return equalNodesArr;
        } else {
            return undefined;
        }
    }

    // ================================================================================================================
    // Search for templates (equal sub-trees) in the context of one domModel
    _labelNodeProcessing_singleDomModelContext(domModelRoot) {
        let domLevel = 0;
        let stackDOMreconstruction = [];
        for (let {node:domSubRoot1, levelChange} of utils.yieldTreeNodes(domModelRoot, NodeProcessing.getYieldNodeChilds())) {

            domLevel += levelChange;
            while (stackDOMreconstruction.length >= domLevel)
                stackDOMreconstruction.pop();
            stackDOMreconstruction.push(domSubRoot1);

            let domTreeGen2 = utils.yieldTreeNodes(domModelRoot, NodeProcessing.getYieldNodeChilds(), 't', stackDOMreconstruction);
            for (let {node:domSubRoot2} of domTreeGen2) {
            if (NodeProcessing.compareNodes(domSubRoot1, domSubRoot2) === true &&
                ! domSubRoot1.tmplRoutine.color.some(c_val => domSubRoot1.tmplRoutine[c_val] === domSubRoot2)) {

                let equalNodesArr = this._getEqualSubRootPartsArr(domSubRoot1, domSubRoot2);
                if (equalNodesArr !== undefined) {
                    for (let pair of equalNodesArr) {
                        pair.domNode.tmplRoutine[this.addRoutine.color] = pair.tmplNode;
                        pair.domNode.tmplRoutine.color.push(this.addRoutine.color);
                        pair.tmplNode.tmplRoutine[this.addRoutine.color +1] = pair.domNode;
                        pair.tmplNode.tmplRoutine.color.push(this.addRoutine.color +1);
                    }
                    this.addRoutine.colorCompliance[this.addRoutine.color] = {
                        context: "sameDOMmodel",
                        // rootNode: domSubRoot2,
                        pairColor: this.addRoutine.color +1
                    };
                    this.addRoutine.colorCompliance[this.addRoutine.color +1] = {
                        context: "sameDOMmodel",
                        // rootNode: domSubRoot1,
                        pairColor: this.addRoutine.color
                    };
                    this.addRoutine.color += 2;
                }
            }}
        }
    }

    // ================================================================================================================
    // Search for sub-templates between domModel and already found templates
    _labelNodeProcessing_domModelVStemplates(domModelRoot) {
        for (let tmplModel of this.templates) {
            if (tmplModel.corrupted !== true) {
            for (let {node:domSubRoot} of utils.yieldTreeNodes(domModelRoot, NodeProcessing.getYieldNodeChilds())) {
            for (let {node:tmplSubRoot} of utils.yieldTreeNodes(tmplModel.tmplRoot, NodeProcessing.getYieldNodeChilds())) {
            if (NodeProcessing.compareNodes(domSubRoot, tmplSubRoot) === true &&
                ! domSubRoot.tmplRoutine.color.some(c_val => domSubRoot.tmplRoutine[c_val] === tmplSubRoot)) {

                let equalNodesArr = this._getEqualSubRootPartsArr(domSubRoot, tmplSubRoot);
                if (equalNodesArr !== undefined) {
                    for (let pair of equalNodesArr) {
                        pair.domNode.tmplRoutine[this.addRoutine.color] = pair.tmplNode;
                        pair.domNode.tmplRoutine.color.push(this.addRoutine.color);
                        pair.tmplNode.tmplRoutine[this.addRoutine.color] = pair.domNode;
                        pair.tmplNode.tmplRoutine.color.push(this.addRoutine.color);
                    }
                    this.addRoutine.colorCompliance[this.addRoutine.color] = {
                        context: "tmpl",
                        // rootNode: tmplSubRoot,
                        tmpl: tmplModel,
                        pairColor: this.addRoutine.color
                    };
                    this.addRoutine.color++;
                }

            }}}}
        }
    }

    // ================================================================================================================
    // Search for sub-templates between domModel and other domModels
    _labelNodeProcessing_domModelVSdomModels(domModelRoot) {
        let subPage_queue = [];
        this.webAppPageList.forEach(val => {
            subPage_queue.push(val.domRoot);
        });
        while (subPage_queue.length > 0) {
            let domModel2Root = subPage_queue.pop();

            for (let {node:domSubRoot2} of utils.yieldTreeNodes(domModel2Root, NodeProcessing.getYieldNodeChilds()))
                if (domSubRoot2.type === 'tmpl') {
                    domSubRoot2.childNodes.forEach(val => {
                        subPage_queue.push(val.child);
                    });
                }

            for (let {node:domSubRoot1} of utils.yieldTreeNodes(domModelRoot, NodeProcessing.getYieldNodeChilds())) {
            for (let {node:domSubRoot2} of utils.yieldTreeNodes(domModel2Root, NodeProcessing.getYieldNodeChilds())) {
                if (domSubRoot2.type === undefined &&
                    NodeProcessing.compareNodes(domSubRoot1, domSubRoot2) === true &&
                    ! domSubRoot1.tmplRoutine.color.some(c_val => domSubRoot1.tmplRoutine[c_val] === domSubRoot2)) {
                    let equalNodesArr = this._getEqualSubRootPartsArr(domSubRoot1, domSubRoot2);
                    if (equalNodesArr !== undefined) {
                        for (let pair of equalNodesArr) {
                            pair.domNode.tmplRoutine[this.addRoutine.color] = pair.tmplNode;
                            pair.domNode.tmplRoutine.color.push(this.addRoutine.color);
                            pair.tmplNode.tmplRoutine[this.addRoutine.color] = pair.domNode;
                            pair.tmplNode.tmplRoutine.color.push(this.addRoutine.color);
                        }
                        this.addRoutine.colorCompliance[this.addRoutine.color] = {
                            context: "domModel",
                            // rootNode: domSubRoot2,
                            pairColor: this.addRoutine.color
                        };
                        this.addRoutine.color++;
                    }

                }
            }}
        }
    }

    // ================================================================================================================
    _labelNodeProcessing(domModelRoot) {

        this._labelNodeProcessing_singleDomModelContext(domModelRoot);
        this._labelNodeProcessing_domModelVStemplates(domModelRoot);
        this._labelNodeProcessing_domModelVSdomModels(domModelRoot);

    }

    // ================================================================================================================
    _carryOutSubtreeRootIntoTmpl(rootNode, subtreeSinkChilds, subtreeSinks){

        // create new node, being root-node for template
        //      we are not going to use "original"" rootNode, because it is used in structure of some global
        //      tree and someone refers to it, we are not going to break that link
        let tmplRoot = Object.assign({}, rootNode);
        // register new template
        let tmpl = this._init_newTmpl(tmplRoot, []);
        this.templates.push(tmpl);

        // reinitialize "original" rootNode, setting its type and properties to "template-pointer" node
        //      node's child nodes are initialized accordingly to subtreeSinks of our subtree, 
        this._initTmplNode(rootNode, tmpl, subtreeSinkChilds, subtreeSinks);
        // unlink subtreeSinkChilds from their subtreeSinks, because their parent is now - rootNode
        subtreeSinks.forEach((val, i) => {
            let j = subtreeSinks[i].childNodes.indexOf(subtreeSinkChilds[i]);
            subtreeSinks[i].childNodes.splice(j, 1);
        });
        // root-node of template has as its parent template header
        tmplRoot.parent = tmpl;
        // patch parent for all child-nodes of our new root-node of template
        for (let childNode of tmpl.tmplRoot.childNodes)
            childNode.parent = tmpl.tmplRoot;
        
        return tmpl;
    }

    // ================================================================================================================
    _getSubtreeFromRootNode(rootNode, checkNodeFitting) {
        let subtreeGen = utils.yieldTreeNodes(rootNode, NodeProcessing.getYieldNodeChilds());

        // Collect equally-colored sub-tree nodes
        let value;
        let {value:{node, levelChange, parent}, done} = subtreeGen.next();
        let subtreeNodesArr = [];
        let subtreeSinkChilds = [];
        let subtreeSinks = []; // subtreeSinkChilds parents
        while (done === false) {
            
            if (checkNodeFitting(node)) {
                subtreeNodesArr.push({
                    domNode: node,
                    levelChange: levelChange
                });
                ({value, done} = subtreeGen.next());
                if (value !== undefined) ({node, levelChange, parent} = value);
            } else {
                subtreeSinkChilds.push(node);
                subtreeSinks.push(parent);
                ({value, done} = subtreeGen.next(false));
                if (value !== undefined) ({node, levelChange, parent} = value);
            }
        }

        return {
            subtreeNodesArr: subtreeNodesArr,
            subtreeSinkChilds: subtreeSinkChilds,
            subtreeSinks: subtreeSinks
        };
    }

    // ================================================================================================================
    _initTmplNode(curRootNode, tmpl, subtreeSinkChilds, subtreeSinks) {

        tmpl.tmplParents.push(curRootNode);

        let parent = curRootNode.parent;
        
        NodeProcessing.nullifyDomNode(curRootNode);
        
        curRootNode.type = 'tmpl';
        curRootNode.childNodes = [];
        curRootNode.parent = parent;
        curRootNode.tmpl = tmpl;
        curRootNode.tmplRoutine = tmpl.tmplRoot.tmplRoutine;
        
        subtreeSinks.forEach((val, i) => {
            if (subtreeSinks[i] === curRootNode)
                subtreeSinks[i] = tmpl.tmplRoot;
        });

        subtreeSinkChilds.forEach((val, i) => {
            curRootNode.childNodes.push({
                tmplNode: subtreeSinks[i],
                child: subtreeSinkChilds[i]
            });
            subtreeSinkChilds[i].parent = curRootNode;
        });
    };

    // ================================================================================================================
    // Search for tree-sink nodes of pairedSubtreeRootNode template pointed from subtreeSimilarNodesArr by color
    // function can not be used to gets sinks of subtreeSimilarNodesArr directly, only its colored images in other structures
    // return value:
    //      pairedSubtreeSinkChilds - sink childs of paired subtree
    //      subtreeSinks - sinks of initial tree
    _getPairedSubtreeSinks(subtreeSimilarNodesArr, color, pairedSubtreeRootNode) {
        
        let pairColor = this.addRoutine.colorCompliance[color].pairColor;

        let pairedSubtreeGen = utils.yieldTreeNodes(pairedSubtreeRootNode, NodeProcessing.getYieldNodeChilds());
        let value;
        let {value:{node}, done} = pairedSubtreeGen.next();
        let pairedSubtreeSinkChilds = [];
        let subtreeSinks = []; // pairedSubtreeSinkChilds parents
        let i = 0;
        while (done === false) {
            
            if (i < subtreeSimilarNodesArr.length && subtreeSimilarNodesArr[i].domNode.tmplRoutine[color] === node) {
                ({value, done} = pairedSubtreeGen.next());
                if (value !== undefined) node = value.node;
                i++;
            } else {
                pairedSubtreeSinkChilds.push(node);
                if (node.parent !== pairedSubtreeRootNode)
                    subtreeSinks.push(node.parent.tmplRoutine[pairColor]);
                else
                    subtreeSinks.push(subtreeSimilarNodesArr[0].domNode); // alternative way to get tmplRoot
                    // this is crunch, because pairedSubtreeRootNode.tmplRoutine[pairColor] will link to original subtreeSimilarNodesArr root,
                    // which is changed into template-pointer node after _carryOutSubtreeRootIntoTmpl operation
                
                ({value, done} = pairedSubtreeGen.next(false));
                if (value !== undefined) node = value.node;
            }
        }
        if (done !== true || i !== subtreeSimilarNodesArr.length)
            throw new Error('Error getting paired subtree tree-sinks. Probably because given two subtrees is not isomorphic.');

        return {pairedSubtreeSinkChilds: pairedSubtreeSinkChilds, subtreeSinks: subtreeSinks};
    };

    // ================================================================================================================
    //  merging procedure can not garantee correctnes of order for child elements attached to template nodes
    _breakApartCorrelatedTemplate(similarNodesArr, color, tmpl/*, subtreeSinkChilds, subtreeSinks*/) {

        // tmpl - is our new template we are extracting
        // curTmpl - is an old template we are breaking apart into:

        let curTmpl = this.addRoutine.colorCompliance[color].tmpl;

        let {pairedSubtreeSinkChilds} = this._getPairedSubtreeSinks(similarNodesArr, color, tmpl.tmplRoot.tmplRoutine[color]);
        let new_tmpls = pairedSubtreeSinkChilds.map((val, i) => this._init_newTmpl(pairedSubtreeSinkChilds[i], []));
        // TODO: If new_tmpl is too small and its NodeProcessing.checkSubtreeArrToBeTmpl === false, then it must be shifted from templates category to domModels

        let complex = false;
        if (tmpl.tmplRoot.tmplRoutine[color] !== curTmpl.tmplRoot)
            complex = true;

        this.emit('tmplPartition', curTmpl);

        // ============================================================================
        // Merge with other template-pointers, holding various subtrees, hooked to
        // processed template and his similarities
        // ============================================================================
        for (let curTmplParent_i = curTmpl.tmplParents.length -1; curTmplParent_i >= 0; curTmplParent_i--) {
            let curTmplParent = curTmpl.tmplParents[curTmplParent_i]

            let ctpcn = curTmplParent.childNodes;
            curTmplParent.childNodes = [];

            let tmplPointer;
            if (complex) {
                tmplPointer = {};
                this._initTmplNode(tmplPointer, tmpl, [], []);
                tmplPointer.parent = curTmplParent;
            } else {
                tmplPointer = curTmplParent;
                curTmpl.tmplParents.splice(curTmplParent_i, 1);
                this._initTmplNode(tmplPointer, tmpl, [], []);
            }

            let subTmplPointers = new_tmpls.map((val, i) => {
                let subTmplPointer = {};
                this._initTmplNode(subTmplPointer, new_tmpls[i], [], []);
                subTmplPointer.parent = tmplPointer;
                return subTmplPointer;
            });
            let i_nt = 0; // new_tmpls counter

            let tmplGen = utils.yieldTreeNodes(tmpl.tmplRoot, NodeProcessing.getYieldNodeChilds(), 's');
            let value;
            let {value:{node:nextTmplNode}, done} = tmplGen.next();
            let nextTmplNode_prev = undefined;

            let pos = complex ? 'h' : 'in'; // higher or inside tmpl
            let level_in = 0;
            for (let {node, levelChange, parent} of utils.yieldTreeNodes(curTmpl.tmplRoot, NodeProcessing.getYieldNodeChilds(), 's')) {
                level_in += levelChange;
                if ((nextTmplNode !== undefined && node === nextTmplNode.tmplRoutine[color]) ||
                    (nextTmplNode_prev !== undefined && node === nextTmplNode_prev.tmplRoutine[color])) {
                    
                    let tmplNode;
                    if (nextTmplNode !== undefined && node === nextTmplNode.tmplRoutine[color]) tmplNode = nextTmplNode;
                    else tmplNode = nextTmplNode_prev;

                    if (pos === 'h') {
                        curTmplParent.childNodes.push({
                            tmplNode: parent,
                            child: tmplPointer
                        });

                        level_in = 0;
                    } else if (pos === 'l') {
                        tmplPointer.childNodes.push({
                            tmplNode: tmplNode,
                            child: subTmplPointers[i_nt]
                        });
                        i_nt ++;
                    }
                    pos = 'in';
                    
                    while (ctpcn.length > 0 && node === ctpcn[0].tmplNode) {
                        tmplPointer.childNodes.push({
                            tmplNode: tmplNode,
                            child: ctpcn[0].child
                        });
                        ctpcn[0].child.parent = tmplPointer;
                        ctpcn.shift();
                    }

                    if (nextTmplNode !== undefined && node === nextTmplNode.tmplRoutine[color]) {
                        ({value, done} = tmplGen.next());
                        if (done === false) {
                            nextTmplNode_prev = nextTmplNode;
                            nextTmplNode = value.node;
                        } else {
                            nextTmplNode_prev = nextTmplNode;
                            nextTmplNode = undefined;
                        }
                    }

                } else {
                    if (done === true && level_in < 0)
                        pos = 'h';
                    else if (pos === 'in')
                        pos = 'l';
                    
                    if (pos === 'h') {
                        while (ctpcn.length > 0 && node === ctpcn[0].tmplNode)
                            curTmplParent.childNodes.push(ctpcn.shift());
                    } else if (pos === 'l') {
                        
                        while (ctpcn.length > 0 && node === ctpcn[0].tmplNode) {
                            let child_struct = ctpcn.shift();
                            subTmplPointers[i_nt].childNodes.push(child_struct);
                            child_struct.child.parent = subTmplPointers[i_nt];
                        }
                    }
                }
            }
        }

        // ============================================================================
        // Cleanup places from where new subtrees and their similarities were moved from
        // ============================================================================
        if (complex) {
            let tmplInCurTmpl = tmpl.tmplRoot.tmplRoutine[color];
            
            if (tmplInCurTmpl.parent.type === undefined)
                tmplInCurTmpl.parent.childNodes.splice(tmplInCurTmpl.parent.childNodes.indexOf(tmplInCurTmpl), 1);
            else if (tmplInCurTmpl.parent.type === 'tmpl')
                tmplInCurTmpl.parent.childNodes.splice(tmplInCurTmpl.parent.childNodes.findIndex(val => val.child === tmplInCurTmpl), 1);
            
            tmplInCurTmpl.parent = tmpl;

            if (! NodeProcessing.checkSubtreeToBeTmpl(curTmpl)) {
                curTmpl.corrupted = true;
                // TODO: merge corrupte templates if and only if they are fully-equal
            }
        }
        for (let new_tmpl of new_tmpls) {
            
            if (new_tmpl.tmplRoot.parent.type === undefined)
                new_tmpl.tmplRoot.parent.childNodes.splice(new_tmpl.tmplRoot.parent.childNodes.indexOf(new_tmpl), 1);
            else if (new_tmpl.tmplRoot.parent.type === 'tmpl')
                new_tmpl.tmplRoot.parent.childNodes.splice(new_tmpl.tmplRoot.parent.childNodes.findIndex(val => val.child === new_tmpl), 1);
            
            new_tmpl.tmplRoot.parent = new_tmpl;

            if (! NodeProcessing.checkSubtreeToBeTmpl(new_tmpl)) {
                new_tmpl.corrupted = true;
                // TODO: merge corrupte templates if and only if they are fully-equal
            }
        }

        this.templates.push(...new_tmpls);
    }

    // ================================================================================================================
    _extractTemplates(domModelRoot) {

        let process_queue = [domModelRoot];
        while (process_queue.length > 0) {

            // if next element is template-pointer, then skip it and proceed with childs
            let curRootNode = process_queue.splice(0, 1)[0];
            if (curRootNode.type === 'tmpl') {
                for (let child of curRootNode.childNodes)
                    process_queue.push(child.child);
                continue;
            }

            // Get possible new template
            let {subtreeNodesArr: similarDomNodesArr, subtreeSinkChilds, subtreeSinks} =
                this._getSubtreeFromRootNode(curRootNode, node => {
                    return utils.arraySimilarity(curRootNode.tmplRoutine.color, node.tmplRoutine.color);
                });

            process_queue.push(...subtreeSinkChilds);
            
            if (curRootNode.tmplRoutine.color.length !== 0 && NodeProcessing.checkSubtreeArrToBeTmpl(similarDomNodesArr)) {

                // TODO: Every time new template is constructed and placed instead of other tmpl places even if template will be absolutely equal or
                // if there is only one other place for template to be merged to or if there is many such places
                //      Maybe some optimization of process can be done?
                //      Any way structure of new template is already in memory and it must go through merge process with other templates

                let tmpl = this._carryOutSubtreeRootIntoTmpl(curRootNode, subtreeSinkChilds, subtreeSinks);
                // root node of our subtree became "template-pointer" node, so it must be corrected on substituted node
                //      after carrying out subtree-root into separate template
                similarDomNodesArr[0].domNode = tmpl.tmplRoot;

                // Insert new template into all other correlated places (shown by colors)
                for (let color of curRootNode.tmplRoutine.color) {

                    // two subtrees is going to be merged into one subtree-template, metainformation of various nodes must not be lost
                    for (let curTmplNode of similarDomNodesArr)
                        nodeHandlers.mergeEqualNodes(curTmplNode.domNode, curTmplNode.domNode.tmplRoutine[color]);

                    if (this.addRoutine.colorCompliance[color].context === 'tmpl') {

                        this._breakApartCorrelatedTemplate(similarDomNodesArr, color, tmpl/*, subtreeSinkChilds, subtreeSinks*/);

                    } else {
                        
                        let pairedRootNode = curRootNode.tmplRoutine[color];

                        let {pairedSubtreeSinkChilds, subtreeSinks} = this._getPairedSubtreeSinks(similarDomNodesArr, color, pairedRootNode);
                        this._initTmplNode(pairedRootNode, tmpl, pairedSubtreeSinkChilds, subtreeSinks);
                    }
                }
            }
        }
    }

    // ================================================================================================================
    _wrapInTemplates(domModelRoot) {

        let process_queue = [domModelRoot];
        while (process_queue.length > 0) {

            // if next element is template-pointer, then skip it and proceed with childs
            let curRootNode = process_queue.splice(0, 1)[0];
            if (curRootNode.type === 'tmpl') {
                for (let child of curRootNode.childNodes)
                    process_queue.push(child.child);
                continue;
            }

            // Get possible new template
            let {subtreeNodesArr: similarDomNodesArr, subtreeSinkChilds, subtreeSinks} =
                this._getSubtreeFromRootNode(curRootNode, node => node.type === undefined);

            process_queue.push(...subtreeSinkChilds);

            if (NodeProcessing.checkSubtreeHasClickable(similarDomNodesArr)) {

                let tmpl = this._carryOutSubtreeRootIntoTmpl(curRootNode, subtreeSinkChilds, subtreeSinks);
                similarDomNodesArr[0].domNode = tmpl.tmplRoot;
                
                if (! NodeProcessing.checkSubtreeArrToBeTmpl(similarDomNodesArr)) {
                    tmpl.corrupted = true;
                    // TODO: merge corrupte templates if and only if they are fully-equal
                }
            }
        }
    }

    // ================================================================================================================
    // function compares two DOM models, extracts templates from first one and returns decomposed DOM model and
    // detected templates ordered trees
    addDomModel(domModel) {

        // Reconstruct parent pointers
        for (let {node, levelChange, parent} of utils.yieldTreeNodes(domModel.domSnapshot, NodeProcessing.getYieldNodeChilds()))
            node.parent = parent;
        
        let webPage = this._init_newWebPage(domModel.url, domModel.domSnapshot);
        webPage.domRoot.parent = webPage;

        this._labelNodeProcessing(domModel.domSnapshot);
        this._extractTemplates(domModel.domSnapshot);
        this._wrapInTemplates(domModel.domSnapshot);
        
        this.webAppPageList.push(webPage);

        this._cleanup_addRoutine();
        return webPage;
    }

    // ================================================================================================================
    // Function converting WebAppTmplModel into html-views
    rebuildDom( webAppPage = null,      // If undefined - all web-pages will be printed, or only specified webPage
                withTmpl = true,        // If false - webPages will be printed skipping templates
                level = 0,              // initial indentation
                tabulation = 2) {

        function stringifyNodeBeginning(node, level, tabulation) {
            if (node.type === undefined) {
                return nodeHandlers.stringifyNodeBeginning(node, level, tabulation);
            } else if (node.type === 'tmpl') {
                return  ' '.repeat(level*tabulation) + '<iframe src="./template-' + node.tmpl.name + '.html">No template.</iframe>\n' +
                        ' '.repeat(level*tabulation) + '<iframeChilds>\n';
            }
        }

        function stringifyNodeEnding(node, level, tabulation) {
            if (node.type === undefined) {
                return nodeHandlers.stringifyNodeEnding(node, level, tabulation);
            } else if (node.type === 'tmpl') {
                return ' '.repeat(level*tabulation) + '</iframeChilds>\n';
            }
        }

        let queue = undefined;
        if (webAppPage !== null) queue = [webAppPage];
        else queue = this.webAppPageList.slice();

        let doms = [];
        let processedTmplNames = [];
        while (queue.length > 0) {
            let webPage = queue.splice(0, 1)[0];
            if (webPage.type === 'template') {
                if (withTmpl && processedTmplNames.indexOf(webPage.name) === -1)
                    processedTmplNames.push(webPage.name);
                else
                    continue;
            }
            let domRoot = webPage.type === 'webPage' ? webPage.domRoot : (webPage.type === 'template' ? webPage.tmplRoot : undefined);

            let dom = '';
            let stack = [];
            for (let {node, levelChange} of utils.yieldTreeNodes(domRoot, NodeProcessing.getYieldNodeChilds('tmpl'), 't')) {

                if (node.type === 'tmpl')
                    queue.push(node.tmpl);

                if (levelChange === 1) {
                    stack.push(node);
                    dom += stringifyNodeBeginning(node, level, tabulation);
                    level += 1;
                } else if (levelChange < 0) {
                    for (let i = 0; i < -levelChange; i++) {
                        level -= 1;
                        dom += stringifyNodeEnding(stack[stack.length -1], level, tabulation);
                        stack.pop();
                    }
                }
                if (levelChange <= 0) {
                    dom += stringifyNodeEnding(stack[stack.length -1], level -1, tabulation);
                    stack.pop();
                    dom += stringifyNodeBeginning(node, level -1, tabulation);
                    stack.push(node);
                }
            }

            for (let i = stack.length -1; i >= 0; i--) {
                level -= 1;
                dom += stringifyNodeEnding(stack[stack.length -1], level, tabulation);
                stack.pop();
            }

            doms.push({
                name: webPage.type + '-' + webPage.name + '.html',
                type: 'webPage',
                dom: dom
            });
        }
        
        return doms;
    }

    // ================================================================================================================
    dumpWebAppTmplModel(dir_path) {
        for (let html of this.rebuildDom())
            fs.writeFileSync(
                path.join(dir_path, html.name),
                "<!DOCTYPE html>\n<html>\n<head></head>\n" + html.dom + "</html>",
                {
                    encoding: 'utf8',
                    flag: 'w',
                    mode: 0o666
                }
            );
    }

    // ================================================================================================================
}

module.exports = {
    NodeProcessing: NodeProcessing,
    WebAppTmplModel: WebAppTmplModel
};
