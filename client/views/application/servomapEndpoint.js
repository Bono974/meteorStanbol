Meteor.call('getListOnto', function(error, results) {
    var ontologies = [];
    var tmp = JSON.parse(results.content);
    for (var cur in tmp) {
        ontologies.push(tmp[cur].uri);
    }
    Session.set('listOnto', ontologies);
    return ontologies;
});

Template.servomap.events({
    'submit .align2ontos': function(event) {
        event.preventDefault();
        var ont1 = event.target['firstOnto']['value'];
        var ont2 = event.target['secondOnto']['value'];
        var binary = event.target['binary']['checked'];
        Meteor.call('align2ontos', ont1, ont2, binary, function(error, results) {
            console.log(results.content);
            return results.content;
        });
    }
});

Template.servomap.helpers({
    "ontoSelectedDUM": function(){
        return Session.get('ontoSelected');
    },
    "listOntos": function() {
        var str = Session.get('listOnto');
        console.log(str);
        return str;
    }
});
