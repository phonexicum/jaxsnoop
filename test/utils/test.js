'use strict';

var assert = require('assert');

// ====================================================================================================================
const utils = require('../../utils/utils.js');

// ====================================================================================================================
describe('utils', () => {
    describe('#yieldTreeNodes()', () => {

        let tree = {
            k: 1,
            child: [{
                k: 2,
                child: [{
                    k: 4,
                    child: []
                }, {
                    k: 5,
                    child: []
                }]
            },{
                k: 3,
                child: [{
                    k: 6,
                    child: []
                }]
            }]
        };

        function* yieldTreeChilds (node){
            for (let child of node.child)
                yield child;
        }

        it('check "topFirst" mode', () => {
            let sequence = [];
            for (let n of utils.yieldTreeNodes(tree, yieldTreeChilds)) {
                sequence.push([n.node.k, n.levelChange, n.parent === undefined ? undefined : n.parent.k]);
            }
            assert.deepStrictEqual(sequence, [[1, 1, undefined], [2, 1, 1], [4, 1, 2], [5, 0, 2], [3, -1, 1], [6, 1, 3]]);
        });

        it('check "bottomFirst" mode', () => {
            let sequence = [];
            for (let n of utils.yieldTreeNodes(tree, yieldTreeChilds, 'b')) {
                sequence.push([n.node.k, n.levelChange, n.parent === undefined ? undefined : n.parent.k]);
            }
            assert.deepStrictEqual(sequence, [[4, 3, 2], [5, 0, 2], [2, -1, 1], [6, 1, 3], [3, -1, 1], [1, -1, undefined]]);
        });

        it('check "extended prufer sequence ButtomUp" mode', () => {
            let sequence = [];
            for (let n of utils.yieldTreeNodes(tree, yieldTreeChilds, 'e')) {
                sequence.push([n.node.k, n.levelChange, n.parent === undefined ? undefined : n.parent.k]);
            }
            assert.deepStrictEqual(sequence, [[4, 3, 2], [2, -1, 1], [5, 1, 2], [2, -1, 1], [1, -1, undefined], [6, 2, 3], [3, -1, 1], [1, -1, undefined]]);
        });

        it('check "sequenctial (topDown)" mode', () => {
            let sequence = [];
            for (let n of utils.yieldTreeNodes(tree, yieldTreeChilds, 's')) {
                sequence.push([n.node.k, n.levelChange, n.parent === undefined ? undefined : n.parent.k]);
            }
            assert.deepStrictEqual(sequence, [[1, 1, undefined], [2, 1, 1], [4, 1, 2], [2, -1, 1], [5, 1, 2], [2, -1, 1], [1, -1, undefined], [3, 1, 1], [6, 1, 3], [3, -1, 1], [1, -1, undefined]]);
        });

        it('check skipping tree nodes in "topFirst" mode', () => {
            let gen = utils.yieldTreeNodes(tree, yieldTreeChilds);
            let {node, levelChange, parent} = gen.next().value;
            assert.deepStrictEqual([node.k, levelChange, parent], [1, 1, undefined]);
            ({node, levelChange, parent} = gen.next().value);
            assert.deepStrictEqual([node.k, levelChange, parent.k], [2, 1, 1]);
            ({node, levelChange, parent} = gen.next(false).value);
            assert.deepStrictEqual([node.k, levelChange, parent.k], [3, 0, 1]);
            ({node, levelChange, parent} = gen.next().value);
            assert.deepStrictEqual([node.k, levelChange, parent.k], [6, 1, 3]);
            assert.deepStrictEqual(gen.next(), { value: undefined, done: true });
        });

        it('check skipping root node in "topFirst" mode', () => {
            let gen = utils.yieldTreeNodes(tree, yieldTreeChilds);
            let {node, levelChange, parent} = gen.next(false).value;
            assert.deepStrictEqual([node.k, levelChange, parent], [1, 1, undefined]);
            assert.deepStrictEqual(gen.next(false), { value: undefined, done: true });
        });

        it ('check stack reconstruction in "topFirst" mode', () => {
            let sequence = [];
            for (let n of utils.yieldTreeNodes(tree, yieldTreeChilds, 't', [tree, tree.child[0], tree.child[0].child[1]])) { // 1 2 5
                sequence.push([n.node.k, n.levelChange, n.parent.k]);
            }
            assert.deepStrictEqual(sequence, [[3, 2, 1], [6, 1, 3]]);
        });
    });
});
