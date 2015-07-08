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

console.log("TOTO1");
        Meteor.call('callAsyncQueryHDTFile', subject, predicate, object, limit, function(err, results) {
console.log("TOTO2");
            var settings = {
                dataset: results
            };
            //storeResults(settings);
console.log("TOTO3");
            loadNew(settings);
console.log("TOTO4");
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
    App.layout = Viva.Graph.Layout.forceDirected(App.graph);
    App.graphics = Viva.Graph.View.webglGraphics();
    App.renderer = Viva.Graph.View.renderer(App.graph, {
        //layout: App.layout, // FIXME
        graphics: App.graphics,
        container: document.getElementById('graph-container')
    });
    App.renderer.run();
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


var events = Viva.Graph.webglInputEvents(App.graphics, App.graph);
events.mouseEnter(function (node) {
    console.log('Mouse entered node: ' + node.id);
}).mouseLeave(function (node) {
    console.log('Mouse left node: ' + node.id);
}).dblClick(function (node) {
    console.log('Double click on node: ' + node.id);
}).click(function (node) {
    console.log('Single click on node: ' + node.id);
});
