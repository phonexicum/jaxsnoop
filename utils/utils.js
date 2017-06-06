// ====================================================================================================================
// tree:     1      modes:  t - 1 2 4 5 3 6             - topFirst
//         2   3            b - 4 5 2 6 3 1             - bottomFirst (consolided prufer sequence)
//        4 5   6           e - 4 2 5 2 1 6 3 1         - extended prufer sequence BottomUp
//                          s - 1 2 4 2 5 2 1 3 6 3 1   - sequential (TopDown)
//
// Skipping node for TopDown modes:
//      let gen = yieldTreeNodesDepthFirst(obj, yieldChilds);
//      gen.next(); - returns X-node
//      gen.next('any not undefined value'); - will skip all childs of X-node and proceed into the tree
//
// nodeStack array can be used to start `yieldTreeNodes` function from middle state, nodeStack must contain nodes,
//      each following node is child of previous node, and `nodeStack[0]` === `tree`
//
// Function yields object: {node: treeNode, levelChange: node position relatively to previous node, parent: pointer to node's parent}
//
function* yieldTreeNodes(tree /*node*/, yieldNodeChilds, mode = 't', middleStack = undefined) {

    let checkStackElemUndef = x => x === undefined ? x : x.n;

    let nodeStack = [];
    let levelChange = 0;
    let skipNode = undefined;

    if (middleStack === undefined) {
        nodeStack.push({
            n: tree,                    // node
            g: yieldNodeChilds(tree)    // child generator
        });
        levelChange ++;

        if (mode === 't' || mode === 's') {
            skipNode = yield {node: tree, levelChange: levelChange, parent: checkStackElemUndef(nodeStack[nodeStack.length -2])};
            levelChange = 0;
            if (skipNode !== undefined) {
                nodeStack.pop(); levelChange--;
            }
        }
    
    } else { // Stack reconstruction

        if (middleStack.length < 1)
            throw new Error('Wrong middleStack array given for yieldTreeNodes function. Wrong middleStack length.');

        let findCorrectGenMiddleState = (node, child) => {
            let gen = yieldNodeChilds(node);
            while (true) {
                let {value, done} = gen.next();
                if (done === true)
                    throw new Error('Wrong middleStack array given for yieldTreeNodes function. Wrong nodes sequence.');
                if (value === child)
                    break;
            }
            return gen;
        };

        for (let i = 0; i < middleStack.length -1; i++) {
            nodeStack.push({
                n: middleStack[i],
                g: findCorrectGenMiddleState(middleStack[i], middleStack[i+1])
            });
            levelChange ++;
        }
        nodeStack.push({
            n: middleStack[middleStack.length -1],
            g: yieldNodeChilds(middleStack[middleStack.length -1])
        });
        levelChange ++;
    }

    let e_justGotUpward = false;
    while (nodeStack.length > 0) {
        // We are going to continue processing children of current node
        let {value, done} = nodeStack[nodeStack.length -1].g.next();
        if (done === false) {
            
            if (mode === 'e' && e_justGotUpward === true){
                skipNode = yield {node: nodeStack[nodeStack.length -1].n, levelChange: -1, parent: checkStackElemUndef(nodeStack[nodeStack.length -2])};
                levelChange = 0;
                if (skipNode !== undefined) {
                    nodeStack.pop(); levelChange--;
                    continue;
                }
                e_justGotUpward = false;
            }

            // Adding new node
            nodeStack.push({n: value, g: yieldNodeChilds(value)});
            levelChange ++;

            if (mode === 't' || mode === 's') {
                skipNode = yield {node: nodeStack[nodeStack.length -1].n, levelChange: levelChange, parent: checkStackElemUndef(nodeStack[nodeStack.length -2])};
                levelChange = 0;
                if (skipNode !== undefined) {
                    nodeStack.pop(); levelChange--;
                    continue;
                }
            }

        } else { // there is no remaining children in current node
            
            if (mode === 'b' || mode === 'e') {
                skipNode = yield {node: nodeStack[nodeStack.length -1].n, levelChange: levelChange, parent: checkStackElemUndef(nodeStack[nodeStack.length -2])};
                levelChange = 0;
                if (skipNode !== undefined) {
                    nodeStack.pop(); levelChange--;
                    continue;
                }
                e_justGotUpward = true;
            }

            nodeStack.pop(); levelChange --;
            
            if (mode === 's' && nodeStack.length > 0) {
                skipNode = yield {node: nodeStack[nodeStack.length -1].n, levelChange: levelChange, parent: checkStackElemUndef(nodeStack[nodeStack.length -2])};
                levelChange = 0;
                if (skipNode !== undefined) {
                    nodeStack.pop(); levelChange--;
                    continue;
                }
            }
        }
    }
}

// ====================================================================================================================
function promise_for(f_check, f_iter, f_body) {

    if (f_check()) {
        return new Promise((res, rej) => { // reject - means 'break', resolve means 'continue'
            try {
                let retVal = f_body(res, rej);
                Promise.resolve(retVal)
                .catch(err => { rej(err); }); // asynchronous errors
            } catch (err) {
                rej(err); // synchronous errors
            }
        })
        .then(() => {
            f_iter();
            return promise_for(f_check, f_iter, f_body);
        });
    }
    else return Promise.resolve();
}

// ====================================================================================================================
function arraySimilarity(arr1, arr2) {
    if (arr1.length === arr2.length &&
        arr1.every(function(e, i) {
            return e === arr2[i];
        })
    ) {
        return true;
    } else {
        return false;
    }
}

// ====================================================================================================================

module.exports = {
    yieldTreeNodes: yieldTreeNodes,
    arraySimilarity: arraySimilarity,
    promise_for: promise_for
};
