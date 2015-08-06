var colorSelected       = 0xFFA500ff;
var colorNonSelected    = 0x009ee8;
QueryResult = new Mongo.Collection("resultHDT"); //FIXME : tabular

console.log("TEST APP", App);
if (typeof(App) == "undefined")
    var App = {};

Template.visualisation.rendered = function() {
    //onLoad();
    //Session.set("vivagraphjs", true);
    pixelOnLoad();
    Session.set("vivagraphjs", false);
};

function pixelOnLoad() {
    if (typeof(App.graph) == "undefined") {
        App.graph = ngraphgraph();
        console.log(App.graph);

        App.graph.addLink(1,2);

        var pixelRender = ngraphpixel;
        App.renderer = pixelRender(App.graph, {
            container: document.getElementById('graph-container')
        });

        App.addCurrentNodeSettings = createNodeSettings;
        App.settingsView = configpixel(App.renderer);
        App.gui = App.settingsView.gui();
        App.nodeSettings = App.addCurrentNodeSettings(App.gui, App.renderer);

        App.renderer.on('nodehover', showNodeDetailsHover);
        App.renderer.on('nodeclick', showNodeDetailsClick);

        console.log(App.renderer);
    }
}

function showNodeDetailsHover(node) {
    if (typeof(node) != "undefined") {
        if (!freeze) {
            updateMetaNode(node);
            App.nodeSettings.id = node.id;
            App.nodeSettings.color = App.renderer.nodeColor(node.id);
            App.nodeSettings.size = App.renderer.nodeSize(node.id);

            var freeze = Session.get("freezeNodeSelection");
            updateRessourceURL(node.id);
            App.nodeSettings.url = Session.get("URLRessource");

            var layout = App.renderer.layout();
            if (layout && layout.pinNode) {
                App.nodeSettings.isPinned = layout.pinNode(node.id);
            }
            App.gui.update();
        }
    }
}
function showNodeDetailsClick(node) {
    Session.set("freezeNodeSelection", !Session.get("freezeNodeSelection"));
    updateMetaNode(node);
    updateRessourceURL(node.id);

    showNodeDetailsHover(node);
}

function createNodeSettings(gui, renderer) {
    var nodeSettings = gui.addFolder('Current Node');
    var currentNode = {
        id: '',
        url: '',
        color: 0,
        size: 0,
        isPinned: false
    };

    nodeSettings.add(currentNode,'id');
    nodeSettings.add(currentNode, 'url');
    nodeSettings.addColor(currentNode, 'color').onChange(setColor);
    nodeSettings.add(currentNode, 'size', 0, 200).onChange(setSize);
    nodeSettings.add(currentNode, 'isPinned').onChange(setPinned);

    return currentNode;

    function setColor(){
        if (currentNode.id) {
            renderer.nodeColor(currentNode.id, currentNode.color);
            renderer.focus();
        }
    }

    function setSize() {
        if (currentNode.id) {
            renderer.nodeSize(currentNode.id, currentNode.size);
            renderer.focus();
        }
    }

    function setPinned() {
        if (!currentNode.id) return;

        var layout = renderer.layout();
        if (layout.pinNode) {
            layout.pinNode(currentNode.id, currentNode.isPinned);
        } else {
            currentNode.isPinned = false;
            gui.update();
        }
        renderer.focus();
    }
}

Template.visualisation.helpers({
    queryResult: function () {
        return QueryResult.find({});
    },
    settingsTable: function () {
        return {
            collection: QueryResult,
            rowsPerPage: 10,
            showFilter: true,
            //fields: ['subject', 'predicate', 'object']
        };
    },
    listPredicate: function(){
        return Session.get('listPredicates');
    },
    URLRessource: function() {
        return Session.get('URLRessource');
    }, vivagraphjs: function() {
        return Session.get('vivagraphjs');
    }
});

Template.visualisation.events({
    "click button[value=renderQuery]": function(event, t) {
        event.preventDefault();
        //var query = t.$('textarea[name=querySparql]')[0].value;
        var query = Session.get("queryUserSPARQL");

        var sparqlChooser1 = t.$('input[name=selectSPARQL]')[0].checked;
        var sparqlChooser2 = t.$('input[name=selectSPARQL]')[1].checked;

        if (sparqlChooser1) {
            Meteor.call('querySelectMarmotta', query, function(errors, results) {
                var settings = {
                    dataset: results.results.bindings,
                    extend: false
                }
                loadNewGraph(settings);
                console.log(settings);



            });
        } else if(sparqlChooser2) {
            Meteor.call('querySelectFuseki', query, function(errors, results) {
                console.log(results.head.vars); // FIXME : may be useful to use these headers for object/subject
                var settings = {
                    dataset: results.results.bindings,
                    extend: false
                }
                loadNewGraph(settings);
            });
        }
   }, "click button[id=loadRandomGraph]":function() {
        loadRandomGraph();
    }, "click button[id=toggleRender]":function() {
        if ($('#toggleRender')[0].value == "pause") {
            $('#toggleRender')[0].value = 'resume';
            $('#toggleRender')[0].innerHTML = 'Resume render';
            pauseRender();
        }
        else if ($('#toggleRender')[0].value == "resume") {
            $('#toggleRender')[0].value = 'pause';
            $('#toggleRender')[0].innerHTML = 'Pause render';
            resumeRender();
        }
    }, "click button[id=toggleFreeze]":function() {
        event.preventDefault();
        // Already set by cliking on a node
        /*if ($('#toggleFreeze')[0].value == "unfreezed") {
            $('#toggleFreeze')[0].value = 'freezed';
            $('#toggleFreeze')[0].innerHTML = 'Release the node selected';
            Session.set('freezeNodeSelection', true);
        }
        else*/
        releaseNodeSelection();
    }, "click button[id=cutSelection]":function() {
        event.preventDefault();
        App.graph.forEachNode(function(node) {
            var nodeUI = App.graphics.getNodeUI(node.id);
            if (nodeUI.color == colorSelected)
                App.graph.removeNode(node.id);
            App.renderer.rerender();
        });
    }, "click button[id=keepSelection]":function() {
        event.preventDefault();

        App.graph.forEachNode(function(node) {
            var nodeUI = App.graphics.getNodeUI(node.id);
            if (nodeUI.color == colorNonSelected)
                App.graph.removeNode(node.id);
            App.renderer.rerender();
        });
    }
});

function releaseNodeSelection() {
    if ($('#toggleFreeze')[0].value == "freezed") {
        $('#toggleFreeze')[0].value = 'unfreezed';
        $('#toggleFreeze')[0].innerHTML = 'No node selected';
        Session.set('freezeNodeSelection', false);
        uncheckNode();
    }
}
function pauseRender() {
    App.renderer.pause();
}
function resumeRender() {
    App.renderer.resume();
}
function storeResultsFull(settings) {
    var dataset = settings.dataset;
    //console.log(dataset);

    QueryResult._collection.remove({});
    for (var cur in dataset)
        QueryResult._collection.insert({
            subject: dataset[cur].subject,
            predicate: dataset[cur].predicate,
            object: dataset[cur].object
        });
    //QueryResult.batchInsert(dataset);
}

App = {};

function filterResultByURI(subject, object) { //don't care about order
    // For now, we filter on the dbpedia
    var t1 = "undefined";
    var t2 = "undefined";
    if (typeof(subject) != "undefined")
        t1 = subject;
    if (typeof(object) != "undefined")
        t2 = object;

    var filters = Session.get("filtersURI");
    if (typeof(filters) == "undefined")
        filters = ['http://dbpedia.org/resource/'];

    for (var cur in filters)
        if ((t1.search(filters[cur]) != -1) || t2.search(filters[cur]) != -1)
            return false;
    return true;
}

function newGraphFromDataset(settings){
    var i = 0;
    var dataset = settings.dataset;
    var root = settings.root;

    var resG;
    if (settings.extend)
        resG = settings.graph;
    else
        resG = Viva.Graph.graph();
        //resG = ngraphgraph();

    if (typeof(root) != "undefined") {
        resG.addNode(root);
        if (dataset.length > 0) {
            var tmpObject = dataset[0].object;
            if (typeof(tmpObject) != "undefined")
                for (var cur in dataset) {
                    var object = dataset[cur].object.value;
                    if (filterResultByURI(object)) {
                        resG.addNode(object);
                        resG.addLink(root, object);
                        i++;
                    }
                }
            else {
                //impossible :
                // subject is the 'root'
                // predicate may be null
                // object is defined
                //resG.addNode('ROOT');
            }
        } else {
            //resG.addNode('ROOT');
            //resG.addLink(root, 'ROOT');
        }
    } else if (dataset.length > 0) {
        var tmpObject = dataset[0].object;
        var tmpSubject = dataset[0].subject;
        if (typeof(tmpObject) != "undefined")
            if (typeof(tmpSubject) != "undefined")
                // <Subject, predicate?, Object>
                for (var cur in dataset) {
                    var subject = dataset[cur].subject.value;
                    var object = dataset[cur].object.value;
                    if (filterResultByURI(subject, object)) {
                        resG.addNode(object);
                        resG.addNode(subject);
                        resG.addLink(subject, object);
                        i++;
                        i++;
                    }
                }
            else {
                // <Subject?, predicate?, Object>
                tmpSubject = "rootSubject"; // FIXME : get the real value from SPARQL query
                resG.addNode(tmpSubject);
                for (var cur in dataset) {
                    var object = dataset[cur].object.value;
                    if (filterResultByURI(subject, object)) {
                        resG.addNode(object);
                        resG.addLink(tmpSubject, object);
                        i++;
                    }
                }
            }
        else {
            if (typeof(tmpSubject) != "undefined") {
                // <Subject, predicate?, Object?>
                tmpObject = "rootObject"; // FIXME : get the real value from SPARQL query
                resG.addNode(tmpObject);
                for (var cur in dataset) {
                    var subject = dataset[cur].subject.value;
                    if (filterResultByURI(subject)) {
                        resG.addNode(subject);
                        resG.addLink(tmpObject, subject);
                        i++;
                    }
                }
            } else {
                // <Subject?, predicate?, Object?>
                // error ?
                //root = "toto";
                //resG.addNode('ROOT');
                //resG.addLink(root, 'ROOT');
            }
        }
    } else {
        //root = "toto";
        //resG.addNode('ROOT');
        //resG.addLink(root, 'ROOT');
    }
    console.log(i);
    return resG;
}



function onLoad() {
    App.graphGenerator = Viva.Graph.generator();
    App.graph = App.graphGenerator.grid(50, 10);
//Def values
//    App.layout = Viva.Graph.Layout.forceDirected(App.graph, {
//        springLength : 30,
//        springCoeff: 0.0008,
//        gravity : -1.2,
//        theta : 0.8,
//        dragCoeff : 0.02,
//        timeStep : 20
//    });

    App.layout = Viva.Graph.Layout.forceDirected(App.graph, {
        springLength : 80,
        springCoeff: 0.0008,
        gravity : -8,
        theta : 0.4,
        dragCoeff : 0.09,
        timeStep : 15
    });

    App.graphics = Viva.Graph.View.webglGraphics();

    var circleNode = buildCircleNodeShader();
    App.graphics.setNodeProgram(circleNode);

    var nodeSize = 12;
    var nodeColor = 0x009ee8;

    App.graphics.node(function (node) {
        return new WebglCircle(nodeSize, nodeColor);
    });

    App.renderer = Viva.Graph.View.renderer(App.graph, {
        layout: App.layout, // FIXME
        graphics: App.graphics,
        renderLinks: true,
        prerender: true,
        container: document.getElementById('graph-container')
    });

    var events = Viva.Graph.webglInputEvents(App.graphics, App.graph);
    events.mouseEnter(function (node) {
        console.log('Mouse entered node: ' + node.id);

        var freeze = Session.get("freezeNodeSelection");
        if (!freeze) {
            updateMetaNode(node);
            updateRessourceURL(node.id);
        }
    }).mouseLeave(function (node) {
        console.log('Mouse left node: ' + node.id);
    }).dblClick(function (node) {
        console.log('Double click on node: ' + node.id);
    }).click(function (node) {
        console.log('Single click on node: ' + node.id);
        var currentNodeColor  = getNodeColor(node);

        if (currentNodeColor == colorSelected) {
            // Click on the same node again
            // Extend node by predicate choosen by UI
            //
            // SELECT ?predicate (COUNT(DISTINCT ?object) AS ?nb_object)
            // WHERE {
            //  <node.id> <predicateUI[x]> ?object .
            // }
            // GROUP BY ?predicate

            var predicateUI = $('select[name=predicateC]')[0];
            predicateUI = predicateUI[predicateUI.selectedIndex];
            if (typeof(predicateUI) != "undefined") {
                predicateUI = predicateUI.value;

                var sparqlChooser1 = $('input[name=selectSPARQL]')[0].checked;
                var sparqlChooser2 = $('input[name=selectSPARQL]')[1].checked;
                var query =
                    "PREFIX rdfs:<http://www.w3.org/2000/01/rdf-schema#>"+
                    "SELECT *"+
                    " WHERE {"+
                    "<"+node.id+"> <"+predicateUI+"> ?object" +
                    "}";
                console.log(query);
                if (sparqlChooser1) {
                    Meteor.call('querySelectMarmotta', query, function(errors, results) {
                        var settings = {
                            dataset: results.results.bindings,
                            root: node.id,
                            extend: true,
                            graph: App.graph
                        }
                        extendGraph(settings);
                        releaseNodeSelection();
                        App.renderer.rerender();
                    });
                } else if(sparqlChooser2) {
                    Meteor.call('querySelectFuseki', query, function(errors, results) {
                        var settings = {
                            dataset: results.results.bindings,
                            root: node.id,
                            extend: true,
                            graph: App.graph
                        }
                        extendGraph(settings);
                        releaseNodeSelection();
                        App.renderer.rerender();
                    });
                }
            }
        } else {
            // First click on the node, unckeck previously checked node
            // --> freeze the selection to freeze the metaNode UI.
            // for now : temporary button to 'release' the selection
            var current  = Session.get("currentNodeSelected");
            updateMetaNode(node);
            updateRessourceURL(node.id);
            uncheckNode(node);
            if (typeof(current) != "undefined" && currentNodeColor != colorSelected)
                setNodeColor(current, colorNonSelected);
            current = Session.get("currentNodeSelected");
            setNodeColor(current, colorSelected);

            var freezeNodeSelection = Session.get('freezeNodeSelection');
            if (typeof(freezeNodeSelection) == 'undefined' || !freezeNodeSelection)
                if ($('#toggleFreeze')[0].value == 'unfreezed') {
                    $('#toggleFreeze')[0].value = 'freezed';
                    $('#toggleFreeze')[0].innerHTML = 'Release the node selected';
                    Session.set('freezeNodeSelection', true);
                }
            App.renderer.rerender();
        }
    });
    var multiSelectOverlay;
    App.renderer.run();

    document.addEventListener('keydown', function(e) {
        if (e.which === 16 && !multiSelectOverlay) { // shift key
            multiSelectOverlay = startMultiSelect(App.graph, App.renderer, App.layout);
        }
    });
    document.addEventListener('keyup', function(e) {
        if (e.which === 16 && multiSelectOverlay) {
            multiSelectOverlay.destroy();
            multiSelectOverlay = null;
        }
    });
}
function updateMetaNode(node) {
    var metaNode = $('textarea[name=tmpMetaNode]');

    var res = "" + node.id +  "\n";
    metaNode.val(res);

    var sparqlChooser1 = $('input[name=selectSPARQL]')[0].checked;
    var sparqlChooser2 = $('input[name=selectSPARQL]')[1].checked;
    var query = "";

    if (!nodeIsIndividual(node.id))
        query = "SELECT ?predicate (COUNT(DISTINCT ?object) AS ?nb_object)"+
            "WHERE {"+
            '<'+node.id+"> ?predicate ?object"+
            "}"+
            "GROUP BY ?predicate";
    else
        query = "SELECT ?predicate (COUNT(DISTINCT ?object) AS ?nb_object)"+
            "WHERE {"+
            "?subject ?predicate ?name."+
            "FILTER (STR(?name)='"+node.id+"')"+
            "}"+
            "GROUP BY ?predicate";

    if (sparqlChooser1)
        Meteor.call('querySelectMarmotta', query, function(errors, results) {
            updateMetaRes(results.results.bindings, metaNode);
        });
    else if(sparqlChooser2)
        Meteor.call('querySelectFuseki', query, function(errors, results) {
            updateMetaRes(results.results.bindings, metaNode);
        });

    function updateMetaRes(results, metaNode) {
        var predicates = [];
        for (var cur in results)
            if (typeof(results[cur].predicate) != "undefined")
                predicates.push(results[cur].predicate.value);
        Session.set('listPredicates', predicates);
    }
}

function updateRessourceURL(node) {
    Meteor.call('testIfRessourceFromRepo', node, function(err, results) {
        Session.set('URLRessource', results);
    });
}
function uncheckNode(node) {
    var nodeTo;
    if (typeof(node) != "undefined")
        nodeTo = node;
    else
        nodeTo = "UNCHECKED";

    var current  = Session.get("currentNodeSelected");
    var previous = Session.get("previousNodeSelected");
    if (typeof(previous) == "undefined")
        Session.set("previousNodeSelected", nodeTo);
    else
        Session.set("previousNodeSelected", current);

    if (typeof(current) != "undefined")
        if (current != nodeTo)
            setNodeColor(current, colorNonSelected);

    Session.set("currentNodeSelected", nodeTo);

    //FIXME ? case if we do a rectangular selection
    App.graph.forEachNode(function clear(node) {
        var nodeUI = App.graphics.getNodeUI(node.id);
        nodeUI.color = colorNonSelected;
    });
}
function setNodeColor(node, color) {
    console.log(node);
    var nodeUII = App.graphics.getNodeUI(node.id);
    if (typeof(nodeUII) != "undefined")
        nodeUII.color = color;
}
function getNodeColor(node) {
    var nodeUII = App.graphics.getNodeUI(node.id);
    return nodeUII.color;
}
function nodeIsIndividual(nodeName) {
    // TODO Blank nodes are not supported for the moment
    if (nodeName.search("http://") == -1)
        //if (nodeName.search("genid-start-") == -1) // Only from HDT/Fuseki SPARQL endpoint
            if (testIfIndividualBySPARQL())
                return true;
    return false;

    function testIfIndividualBySPARQL() { // Marmotta
        // an object can begin with _:
        // so : _:node can be an object
        // as in _:14e481d5eebd6
        // SELECT *
        // WHERE {
        //  _:14e67b500b833a ?predicate ?object
        // }
        // LIMIT 10
        //
        // TODO TODO
        return true; // Test if 'node' is individual or entity via SPARQL query
    }
}
function loadRandomGraph() {
    App.graph.clear();
    var newGraph = App.graphGenerator.grid(Math.random() * 20 |0 , Math.random() * 20 |0);
    copyGraph(newGraph, App.graph);
}
function loadNewGraph(settings) {
    App.graph.clear();
    var newGraph = newGraphFromDataset(settings);
    copyGraph(newGraph, App.graph);

    console.log(App.renderer.layout());
    precompute(5000);
    App.renderer.focus();
    //App.renderer.autofit();

    function precompute(iterations) {
        var i = 0;
        while(iterations > 0 && i <40) {
            App.renderer.layout().step();
            iterations--;
            i++;
        }
        if (iterations > 0) {
            if (!App.renderer.stable())
                setTimeout(function(){
                    precompute(iterations);
                }, 0);
        }
    }
}
function extendGraph(settings) {
    newGraphFromDataset(settings);
}
function copyGraph(from, to) {
    to.beginUpdate();
    from.forEachLink(copyLink);
    to.endUpdate();
    function copyLink(link) {
        to.addLink(link.fromId, link.toId);
    }
}
function WebglCircle(size, color) {
    this.size = size;
    this.color = color;
}
function buildCircleNodeShader() {
    var ATTRIBUTES_PER_PRIMITIVE = 4,
        nodesFS = [
            'precision mediump float;',
        'varying vec4 color;',
        'void main(void) {',
            '   if ((gl_PointCoord.x - 0.5) * (gl_PointCoord.x - 0.5) + (gl_PointCoord.y - 0.5) * (gl_PointCoord.y - 0.5) < 0.25) {',
                '     gl_FragColor = color;',
                '   } else {',
                    '     gl_FragColor = vec4(0);',
                    '   }',
                '}'].join('\n'),
                nodesVS = [
                    'attribute vec2 a_vertexPos;',
                // Pack clor and size into vector. First elemnt is color, second - size.
                // Since it's floating point we can only use 24 bit to pack colors...
                // thus alpha channel is dropped, and is always assumed to be 1.
                'attribute vec2 a_customAttributes;',
                'uniform vec2 u_screenSize;',
                'uniform mat4 u_transform;',
                'varying vec4 color;',
                'void main(void) {',
                    '   gl_Position = u_transform * vec4(a_vertexPos/u_screenSize, 0, 1);',
                    '   gl_PointSize = a_customAttributes[1] * u_transform[0][0];',
                    '   float c = a_customAttributes[0];',
                    '   color.b = mod(c, 256.0); c = floor(c/256.0);',
                    '   color.g = mod(c, 256.0); c = floor(c/256.0);',
                    '   color.r = mod(c, 256.0); c = floor(c/256.0); color /= 255.0;',
                    '   color.a = 1.0;',
                    '}'].join('\n');
                    var program,
                        gl,
                        buffer,
                        locations,
                        utils,
                        nodes = new Float32Array(64),
                        nodesCount = 0,
                        canvasWidth, canvasHeight, transform,
                        isCanvasDirty;
                    return {
                        /**
                         * Called by webgl renderer to load the shader into gl context.
                         */
                        load : function (glContext) {
                            gl = glContext;
                            webglUtils = Viva.Graph.webgl(glContext);
                            program = webglUtils.createProgram(nodesVS, nodesFS);
                            gl.useProgram(program);
                            locations = webglUtils.getLocations(program, ['a_vertexPos', 'a_customAttributes', 'u_screenSize', 'u_transform']);
                            gl.enableVertexAttribArray(locations.vertexPos);
                            gl.enableVertexAttribArray(locations.customAttributes);
                            buffer = gl.createBuffer();
                        },
                             /**
                              * Called by webgl renderer to update node position in the buffer array
                              *
                              * @param nodeUI - data model for the rendered node (WebGLCircle in this case)
                              * @param pos - {x, y} coordinates of the node.
                              */
                             position : function (nodeUI, pos) {
                                 var idx = nodeUI.id;
                                 nodes[idx * ATTRIBUTES_PER_PRIMITIVE] = pos.x;
                                 nodes[idx * ATTRIBUTES_PER_PRIMITIVE + 1] = pos.y;
                                 nodes[idx * ATTRIBUTES_PER_PRIMITIVE + 2] = nodeUI.color;
                                 nodes[idx * ATTRIBUTES_PER_PRIMITIVE + 3] = nodeUI.size;
                             },
                             /**
                              * Request from webgl renderer to actually draw our stuff into the
                              * gl context. This is the core of our shader.
                              */
                             render : function() {
                                 gl.useProgram(program);
                                 gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                                 gl.bufferData(gl.ARRAY_BUFFER, nodes, gl.DYNAMIC_DRAW);
                                 if (isCanvasDirty) {
                                     isCanvasDirty = false;
                                     gl.uniformMatrix4fv(locations.transform, false, transform);
                                     gl.uniform2f(locations.screenSize, canvasWidth, canvasHeight);
                                 }
                                 gl.vertexAttribPointer(locations.vertexPos, 2, gl.FLOAT, false, ATTRIBUTES_PER_PRIMITIVE * Float32Array.BYTES_PER_ELEMENT, 0);
                                 gl.vertexAttribPointer(locations.customAttributes, 2, gl.FLOAT, false, ATTRIBUTES_PER_PRIMITIVE * Float32Array.BYTES_PER_ELEMENT, 2 * 4);
                                 gl.drawArrays(gl.POINTS, 0, nodesCount);
                             },
                             /**
                              * Called by webgl renderer when user scales/pans the canvas with nodes.
                              */
                             updateTransform : function (newTransform) {
                                 transform = newTransform;
                                 isCanvasDirty = true;
                             },
                             /**
                              * Called by webgl renderer when user resizes the canvas with nodes.
                              */
                             updateSize : function (newCanvasWidth, newCanvasHeight) {
                                 canvasWidth = newCanvasWidth;
                                 canvasHeight = newCanvasHeight;
                                 isCanvasDirty = true;
                             },
                             /**
                              * Called by webgl renderer to notify us that the new node was created in the graph
                              */
                             createNode : function (node) {
                                 nodes = webglUtils.extendArray(nodes, nodesCount, ATTRIBUTES_PER_PRIMITIVE);
                                 nodesCount += 1;
                             },
                             /**
                              * Called by webgl renderer to notify us that the node was removed from the graph
                              */
                             removeNode : function (node) {
                                 if (nodesCount > 0) { nodesCount -=1; }
                                 if (node.id < nodesCount && nodesCount > 0) {
                                     // we do not really delete anything from the buffer.
                                     // Instead we swap deleted node with the "last" node in the
                                     // buffer and decrease marker of the "last" node. Gives nice O(1)
                                     // performance, but make code slightly harder than it could be:
                                     webglUtils.copyArrayPart(nodes, node.id*ATTRIBUTES_PER_PRIMITIVE, nodesCount*ATTRIBUTES_PER_PRIMITIVE, ATTRIBUTES_PER_PRIMITIVE);
                                 }
                             },
                             /**
                              * This method is called by webgl renderer when it changes parts of its
                              * buffers. We don't use it here, but it's needed by API (see the comment
                              * in the removeNode() method)
                              */
                             replaceProperties : function(replacedNode, newNode) {},
                    };
                }


            function startMultiSelect(graph, renderer, layout) {
                var graphics = renderer.getGraphics();
                var domOverlay = document.querySelector('.graph-overlay');
                var overlay = createOverlay(domOverlay);
                overlay.onAreaSelected(handleAreaSelected);

                return overlay;

                function handleAreaSelected(area) {
                    // For the sake of this demo we are using silly O(n) implementation.
                    // Could be improved with spatial indexing if required.
                    var topLeft = graphics.transformClientToGraphCoordinates({
                        x: area.x,
                        y: area.y
                    });

                    var bottomRight = graphics.transformClientToGraphCoordinates({
                        x: area.x + area.width,
                        y: area.y + area.height
                    });

                    graph.forEachNode(higlightIfInside);
                    renderer.rerender();

                    return;

                    function higlightIfInside(node) {
                        var nodeUI = graphics.getNodeUI(node.id);
                        if (isInside(node.id, topLeft, bottomRight)) {
                            nodeUI.color = colorSelected; //0xFFA500ff;
                            nodeUI.size = 10;
                        } else {
                            nodeUI.color = colorNonSelected;//0x009ee8ff;
                            nodeUI.size = 10;
                        }
                    }

                    function isInside(nodeId, topLeft, bottomRight) {
                        var nodePos = layout.getNodePosition(nodeId);
                        return (topLeft.x < nodePos.x && nodePos.x < bottomRight.x &&
                                topLeft.y < nodePos.y && nodePos.y < bottomRight.y);
                    }
                }
            }
            function createOverlay(overlayDom) {
                var selectionClasName = 'graph-selection-indicator';
                var selectionIndicator = overlayDom.querySelector('.' + selectionClasName);
                if (!selectionIndicator) {
                    selectionIndicator = document.createElement('div');
                    selectionIndicator.className = selectionClasName;
                    overlayDom.appendChild(selectionIndicator);
                }

                var notify = [];
                var dragndrop = Viva.Graph.Utils.dragndrop(overlayDom);
                var selectedArea = {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0
                };
                var startX = 0;
                var startY = 0;

                dragndrop.onStart(function(e) {
                    startX = selectedArea.x = e.clientX;
                    startY = selectedArea.y = e.clientY;
                    selectedArea.width = selectedArea.height = 0;

                    updateSelectedAreaIndicator();
                    selectionIndicator.style.display = 'block';
                });

                dragndrop.onDrag(function(e) {
                    recalculateSelectedArea(e);
                    updateSelectedAreaIndicator();
                    notifyAreaSelected();
                });

                dragndrop.onStop(function() {
                    selectionIndicator.style.display = 'none';
                });

                overlayDom.style.display = 'block';
                return {
                    onAreaSelected: function(cb) {
                        notify.push(cb);
                    },
                        destroy: function () {
                            overlayDom.style.display = 'none';
                            dragndrop.release();
                        }
                };

                function notifyAreaSelected() {
                    notify.forEach(function(cb) {
                        cb(selectedArea);
                    });
                }

                function recalculateSelectedArea(e) {
                    selectedArea.width = Math.abs(e.clientX - startX);
                    selectedArea.height = Math.abs(e.clientY - startY);
                    selectedArea.x = Math.min(e.clientX, startX);
                    selectedArea.y = Math.min(e.clientY, startY);
                }

                function updateSelectedAreaIndicator() {
                    selectionIndicator.style.left = selectedArea.x + 'px';
                    selectionIndicator.style.top = selectedArea.y + 'px';
                    selectionIndicator.style.width = selectedArea.width + 'px';
                    selectionIndicator.style.height = selectedArea.height + 'px';
                }
            }
