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

        Meteor.call('callAsyncQueryHDTFile', subject, predicate, object, function(err, results) {
            var settings = {
                dataset: results
            };
            loadNew(settings);
            storeResults(settings);
        });
    }, "click button[id=loadNew]":function() {
        console.log('loadNew', App);
        loadNew();
    }
});

function storeResults(settings) {
    var dataset = settings.dataset;
    console.log(dataset);

    //QueryResult.remove({});
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
        resG.addNode('root', dataset[0].subject);
        for (var cur in dataset) {
            resG.addNode(cur, dataset[cur].object);
            resG.addLink('root', cur, dataset[cur].predicate);
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


//var events = Viva.Graph.webglInputEvents(webGLGraphics, graph);
//events.mouseEnter(function (node) {
//    console.log('Mouse entered node: ' + node.id);
//}).mouseLeave(function (node) {
//    console.log('Mouse left node: ' + node.id);
//}).dblClick(function (node) {
//    console.log('Double click on node: ' + node.id);
//}).click(function (node) {
//    console.log('Single click on node: ' + node.id);
//});
