// ====================================================================================================================
// tree:     1      modes:  t - 1 2 4 5 3 6             - topFirst
//         2   3            b - 4 5 2 6 3 1             - bottomFirst (consolided prufer sequence)
//        4 5  6            e - 4 2 5 2 1 6 3 1         - extended prufer sequence BottomUp
//                          s - 1 2 4 2 5 2 1 3 6 3 1   - sequential (TopDown)
//
// Skipping node for TopDown modes:
//      let gen = yieldTreeNodesDepthFirst(obj, yieldChilds);
//      gen.next(); - returns X-node
//      gen.next('any not undefined value'); - will skip all childs of X-node and proceed into the tree
//
// Function yields objects: {node: treeNode, levelChange: node position relatively to previous node}
//
function* yieldTreeNodes(tree, yieldNodeChilds, mode = 't'){
    let nodeStack = [{
        n: tree,                    // node
        g: yieldNodeChilds(tree)    // child generator
    }];
    let skipNode = undefined;
    if (mode === 't' || mode === 's') {
        skipNode = yield {node: tree, levelChange: 1};
        if (skipNode !== undefined) {
            nodeStack.pop(); levelChange--;
        }
    }

    let levelChange = 0;
    let e_justGotUpward = false;
    while (nodeStack.length > 0) {
        // We are going to continue processing children of current node
        let {value, done} = nodeStack[nodeStack.length -1].g.next();
        if (done === false) {
            
            if (mode === 'e' && e_justGotUpward === true){
                skipNode = yield {node: nodeStack[nodeStack.length -1].n, levelChange: -1};
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
                skipNode = yield {node: nodeStack[nodeStack.length -1].n, levelChange: levelChange};
                levelChange = 0;
                if (skipNode !== undefined) {
                    nodeStack.pop(); levelChange--;
                    continue;
                }
            }

        } else { // there is no remaining children in current node
            
            if (mode === 'b' || mode === 'e') {
                skipNode = yield {node: nodeStack[nodeStack.length -1].n, levelChange: levelChange};
                levelChange = 0;
                if (skipNode !== undefined) {
                    nodeStack.pop(); levelChange--;
                    continue;
                }
                e_justGotUpward = true;
            }

            nodeStack.pop(); levelChange --;
            
            if (mode === 's' && nodeStack.length > 0) {
                skipNode = yield {node: nodeStack[nodeStack.length -1].n, levelChange: levelChange};
                levelChange = 0;
                if (skipNode !== undefined) {
                    nodeStack.pop(); levelChange--;
                    continue;
                }
            }
        }
    }
}

module.exports = {
    yieldTreeNodes: yieldTreeNodes
};
