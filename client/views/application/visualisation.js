QueryResult = new Mongo.Collection("resultHDT");

Template.visualisation.rendered = function() {
    onLoad();
};

Template.visualisation.helpers({
    queryResult: function () {
        return QueryResult.find({});
    },settingsTable: function () {
        return {
            collection: QueryResult,
            rowsPerPage: 10,
            showFilter: true,
            fields: ['subject', 'predicate', 'object']
        };
    }
});

Template.visualisation.events({
    "click button[value=renderQuery]": function(event, t) {
        event.preventDefault();
        var subject = t.$('input[name=subject]')[0].value;
        var predicate = t.$('input[name=predicate]')[0].value;
        var object = t.$('input[name=object]')[0].value;
        var limit = parseInt(t.$('input[name=limit]')[0].value);
        console.log(limit);
        if (isNaN(limit))
            limit = 100; // default value

        Meteor.call('callAsyncQueryHDTFile', subject, predicate, object, limit, function(err, results) {
            var settings = {
                dataset: results
            };
            //storeResults(settings);
            loadNew(settings);
        });
    }, "click button[id=loadRandom]":function() {
        console.log('loadRandom', App);
        loadRandom();
    }, "click button[id=toggleRender]":function() {

        console.log($('#toggleRender'));
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
    }
});


function pauseRender() {
    App.renderer.pause();
}
function resumeRender() {
    App.renderer.resume();
}
function storeResults(settings) {
    var dataset = settings.dataset;
    //console.log(dataset);

    QueryResult._collection.remove({});
    for (var cur in dataset)
        QueryResult._collection.insert({
            subject: dataset[cur].subject,
            predicate: dataset[cur].predicate,
            object: dataset[cur].object});

    //QueryResult.batchInsert(dataset);
}

App = {};

function newGraphFromHDTResultSet(dataset){
    var resG = Viva.Graph.graph();
    if (dataset.length > 0) {
        for (var cur in dataset) {
            resG.addNode(dataset[cur].object);
            resG.addNode(dataset[cur].predicate);
            resG.addLink(dataset[cur].subject, dataset[cur].object, dataset[cur].predicate);
        }
    }
    return resG
}

var App = {};

function onLoad() {
    App.graphGenerator = Viva.Graph.generator();
    App.graph = App.graphGenerator.grid(50, 10);
    App.layout = Viva.Graph.Layout.forceDirected(App.graph, {
        //springLength : 10,
        springCoeff: 0.0008,
        dragCoeff : 0.02,
        gravity : -1.2
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
        container: document.getElementById('graph-container')
    });

    var events = Viva.Graph.webglInputEvents(App.graphics, App.graph);
    events.mouseEnter(function (node) {
        console.log('Mouse entered node: ' + node.id);
        console.log(node);

        var subject = node.id;
        var predicate = null;
        var object = null;
        var limit = 100; //FIXME



        App.graph.forEachLinkedNode(node.id, function(linkedNode, link) {
            console.log("Connected node: ", linkedNode.id, linkedNode.data);
            console.log(link);
        });



        //Meteor.call("callAsyncQueryHDTFile", subject, predicate, object, limit, function (err, results) {
        //    console.log("LOLOLOL");
        //    console.log(results)
        //});
    }).mouseLeave(function (node) {
        console.log('Mouse left node: ' + node.id);
    }).dblClick(function (node) {
        console.log('Double click on node: ' + node.id);
    }).click(function (node) {
        console.log('Single click on node: ' + node.id);
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

function loadRandom() {
    App.graph.clear();
    var newGraph = App.graphGenerator.grid(Math.random() * 20 |0 , Math.random() * 20 |0);
    copyGraph(newGraph, App.graph);
}

function loadNew(settings) {
    App.graph.clear();

    var newGraph = newGraphFromHDTResultSet(settings.dataset);
    //var newGraph = App.graphGenerator.grid(Math.random() * 20 |0 , Math.random() * 20 |0);
    copyGraph(newGraph, App.graph);
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
        nodeUI.color = 0xFFA500ff;
        nodeUI.size = 20;
      } else {
        nodeUI.color = 0x009ee8ff;
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
