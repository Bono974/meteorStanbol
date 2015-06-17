Meteor.call('getListOnto', function(error, results) {
    Session.set('listOnto', results.content);
    return results.content;
});

Template.repositoryOnto.listOntos = function() {
    var str = Session.get('listOnto');
    return str.split(',');
};

Template.metadata.METAS = function() {
    var str = Session.get('META');

    var parsed = JSON.parse(str);
    var arr = [];
    for(var x in parsed)
        arr.push( "--" + x + " : " + parsed[x]);
    return arr;
};

Template.metadata.ontoSelect = function() {
    var str = Session.get('ontoSelected');
    return str;
};

Template.repositoryOnto.events({
    "click button[value=open]": function(event, t){
        //code for submit
        event.preventDefault();
        var onto = t.$("form.getMetaOntoForm select[name=ontology]").val();
        Session.set('ontoSelected', onto);
        Meteor.call('getMetaOnto', onto, function(error, results) {
            console.log(results.content);
            Session.set('META', results.content);
            return results.content;
        });
    },
    "click button[value=delete]": function(event, t){
        event.preventDefault();
        var onto = t.$("form.getMetaOntoForm select[name=ontology]").val();
        if (confirm("Êtes vous sûr de vouloir supprimer l'ontologie " + onto + " du dépôt ?")) {
            Meteor.call('deleteOnto', onto);
            console.log("Ontology :"+ onto + " deleted from the repository");
            Meteor.call('getListOnto', function(error, results) {
                Session.set('listOnto', results.content);
                return results.content;
            });
        }
     },
    "click button[value=addOntology]": function(event, t) {
        event.preventDefault();
        var onto = t.$("form.addOntology input[name=ontology]").val();
        var format = t.$("form.addOntology select[name=format]").val();

        console.log(onto);
        console.log(format);
        Meteor.call('addOntology', onto, format, function(error, results) {
            console.log(error);
            return results;
        });
    }
});
function test() {
    var graph = Viva.Graph.graph();
    graph.addNode('bruno', '4b2188722d3b8197d775f6b665f5f253');
    graph.addLink(1, 'bruno');
    graph.addLink(2, 'bruno');
    graph.addLink(3, 'bruno');

    graph.addLink(1, 2);
    graph.addLink(2, 3);
    graph.addLink(3, 1);



    var graphics = Viva.Graph.View.svgGraphics();
    graphics.node(function(node) {
        var url = 'https://secure.gravatar.com/avatar/' + node.data;
        return Viva.Graph.svg('image')
        .attr('width', 24)
        .attr('height', 24)
        .link(url);
    });
    var renderer = Viva.Graph.View.renderer(graph,
            {
                graphics: graphics,
                container: document.getElementById("VISU")
            });
    renderer.run();
}
Template.visualisation.rendered = function() {
    test();
};

