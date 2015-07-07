var stanbolURL = "http://localhost:8081";
var marmottaURL = "http://localhost:8080/marmotta";

Meteor.startup(function () {
    refreshListOnto();
});

Template.repositoryOnto.helpers({
    "listOntos": function() {
        var str = Session.get('listOnto');
        return str;
    }
});

Template.metadata.helpers({
    "METAS": function() {
        var str = Session.get('META');

        var parsed = JSON.parse(str);
        var arr = [];
        for(var x in parsed)
            arr.push( "--" + x + " : " + parsed[x]);
        return arr;
    }, "ontoSelect": function() {
        return Session.get('ontoSelected');
    }
});

function refreshListOnto() {
    Meteor.call('getListOnto', function(error, results) {
        var ontologies = [];
        var tmp = JSON.parse(results.content);
        for (var cur in tmp) {
            ontologies.push(tmp[cur].uri);
        }
        Session.set('listOnto', ontologies);
        return ontologies;
    });
}

Template.repositoryOnto.events({
    "click button[value=open]": function(event, t){
        event.preventDefault();
        var onto = t.$("form.getMetaOntoForm select[name=ontology]").val();
        Session.set('ontoSelected', onto);
        Meteor.call('getMetaOnto', onto, function(error, results) {
            console.log(results.content);
            Session.set('META', results.content);
            return results.content;
        });
    }, "click button[value=delete]": function(event, t){
        event.preventDefault();
        var onto = t.$("form.getMetaOntoForm select[name=ontology]").val();
        if (confirm("Êtes vous sûr de vouloir supprimer l'ontologie " + onto + " du dépôt ?")) {
            Meteor.call('deleteOnto', onto, function(errors, results) {
                console.log("Ontology :"+ onto + " deleted from the repository");
                refreshListOnto();
            });
        }
    }, "click button[value=addOntology]": function(event, t) {
        event.preventDefault();
        var onto = t.$('form.addOntology input[name=ontology]')[0].files[0];
        var format = t.$("form.addOntology select[name=format]").val();
        var context = t.$("form.addOntology input[name=context]").val();

        if (context === "") {
            alert("Choississez un nom pour le graphe RDF à importer!");
            return;
        } else if (typeof onto === "undefined") {
            alert("Pas de fichier sélectionné !");
            return;
        }

        var url = marmottaURL + "/import/upload?context=" + context;

        var form = new FormData({
            version: "1.0.0-rc1"
        });

        $.ajax({
            url: url,
            type: "POST",
            data: onto,
            contentType: format,
            success: function(res) {
                //console.log(res);
                console.log("Ontology : "+ onto.name + " added from the repository");
                refreshListOnto();
            },
            error: function(xhr){
                console.log(xhr);
                alert("Erreur dans l'ajout de l'ontologie "+onto.name+" avec le format "+ format + " essayez avec un autre format");
            },
            processData: false  // tell jQuery not to process the data
                //contentType: false   // tell jQuery not to set contentType
        });
    }
});
