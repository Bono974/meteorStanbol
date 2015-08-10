var colorSelected       = 0xFFA500ff;
var colorNonSelected    = 0x009ee8;

var marmottaURL = "http://localhost:8080/marmotta";

Meteor.call('getListOnto', function(error, results) {
    var ontologies = [];
    var tmp = JSON.parse(results.content);
    for (var cur in tmp) {
        ontologies.push(tmp[cur].uri);
    }
    Session.set('listOnto', ontologies);
    return ontologies;
});

function align(ont1, ont2, binary){ //TODO : binary OSGi : TODO
    Session.set("mapDone", "In progress...");
    Meteor.call('align2ontos', ont1, ont2, binary,
            function(error, results) {
                console.log(results.content);
                Session.set("mapDone", "Done.");
            });
}

function updateResultAvailable() {
    var ont1 = $('select[name=firstOnto]')[0];
    ont1 = ont1[ont1.selectedIndex].value;
    var ont2 = $('select[name=secondOnto]')[0];
    ont2 = ont2[ont2.selectedIndex].value;

    Meteor.call("getAlignmentsO1O2", ont1, ont2, function(err, results) {
        // TODO : Show alignments into a visualisation template via vivagraphjs or other.
        //And then let user edit via UI, then add them all into Marmotta/Triplestore
        var fileArray = results.split('\n');
        Session.set('mappings', fileArray);
        Session.set('mappingsTxt', results);
        //console.log(fileArray);
    });
}
function confirmMappings() {
    var ont1 = $('select[name=firstOnto]')[0];
    ont1 = ont1[ont1.selectedIndex].value;
    var ont2 = $('select[name=secondOnto]')[0];
    ont2 = ont2[ont2.selectedIndex].value;

    var settings = {
        author:"Bruno",
        tool:"ServOMap"
    };

    Meteor.call("putAlignmentsO1O2", ont1, ont2, settings, function(err, results) {
        console.log("EN COURS");
    });
}

function newGraphFromDataset(settings) {
    var array = settings; // for now ?
    var resG = Viva.Graph.graph();

    if (array[0].search("Erreur") == -1) //FIXME
        for (var cur in array) {
            var tmp = array[cur].split(';');
            if (tmp.length >=2) {
                resG.addNode(tmp[0]);
                resG.addNode(tmp[1]);
                resG.addLink(tmp[0], tmp[1]);
            }
        }
    return resG;
}
function pauseRender() {
    App.renderer.pause();
}
function resumeRender() {
    App.renderer.resume();
}
Template.servomap.events({
    'click button[value=align]': function(event, t) {
        event.preventDefault();
        var ont1 = t.$('form.align2ontos select[name=firstOnto]')[0];
        ont1 = ont1[ont1.selectedIndex].value;
        var ont2 = t.$('form.align2ontos select[name=secondOnto]')[0];
        ont2 = ont2[ont2.selectedIndex].value;
        var referenceFile = t.$('form.align2ontos input[name=referenceFile]')[0]['files'][0];

        var binary = t.$('form.align2ontos input[name=binary]').val();

        if (typeof referenceFile != "undefined") {
            var reader = new FileReader();
            reader.onload = function(fileLoadEvent) {
                var settings = {
                    referenceFileBuffer: reader.result
                };
                Meteor.call('referenceFileFolder', ont1, ont2, settings,
                        function(err, results) {
                            align(ont1, ont2, binary);
                        });
            };
            reader.readAsBinaryString(referenceFile);
        } else {
            var settings = {
                //referenceFileBuffer: null
            };
            Meteor.call('referenceFileFolder', ont1, ont2, settings,
                        function(err, results) {
                            align(ont1, ont2, binary);
                        });
        }
    }, 'change select[name=firstOnto]': function(event, t) {
        event.preventDefault();
        updateResultAvailable();
    }, 'change select[name=secondOnto]': function (event, t) {
        event.preventDefault();
        updateResultAvailable();
    }, 'click button[value=visualiseMappings]': function(event, t) {
        event.preventDefault();
        loadNewGraph(Session.get('mappings'));
    }, "click button[value=putMappings]":function(event, t) {
        event.preventDefault();
        // TODO : Get modifications from Session.get("mappings")
        if (confirm("Do you want to add these mappings into the triplestore ?"))
            confirmMappings();
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
    }
});

Template.mappingResults.helpers({
    "editorOptions": function() {
        return {
            lineNumbers: true,
            mode: "C",
            theme: "solarized dark",
            scrollbarStyle: "simple"
        };
    }
});

Template.servomap.helpers({
    "ontoSelectedDUM": function(){
        return Session.get('ontoSelected');
    }, "listOntos": function() {
        var str = Session.get('listOnto');
        console.log(str);
        return str;
    }, "tool": function() {
        return "ServOMap";
    }, "DONE" : function() {
        return Session.get("mapDone");
    }
});

Template.visuVivaGraphMappings.rendered = function() {
    onLoad();
};

var App = {};

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
        springLength : 10,
        springCoeff: 0.0005,
        gravity : -1.2,
        //theta : 0.4,
        dragCoeff : 0.02,
        //timeStep : 15
    });

    //App.graphics = Viva.Graph.View.webglGraphics(); // FIXME ? SVG instead ?
    App.graphics = Viva.Graph.View.svgGraphics();

    //var circleNode = buildCircleNodeShader();
    //App.graphics.setNodeProgram(circleNode);

    var nodeSize = 12;
    var nodeColor = 0x009ee8;

    App.renderer = Viva.Graph.View.renderer(App.graph, {
        layout: App.layout, // FIXME
        graphics: App.graphics,
        container: document.getElementById('graph-container')
    });

    //var events = Viva.Graph.webglInputEvents(App.graphics, App.graph);
    //events.mouseEnter(function (node) {
    //    console.log('Mouse entered node: ' + node.id);
    //}).mouseLeave(function (node) {
    //    console.log('Mouse left node: ' + node.id);
    //}).dblClick(function (node) {
    //    console.log('Double click on node: ' + node.id);
    //}).click(function (node) {
    //    console.log('Single click on node: ' + node.id);
    //});

    App.renderer.run();
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
function loadNewGraph(settings) {
    App.graph.clear();
    var newGraph = newGraphFromDataset(settings);
    copyGraph(newGraph, App.graph);
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
