Meteor.call('getListOnto', function(error, results) {
    var ontologies = [];
    var tmp = JSON.parse(results.content);
    for (var cur in tmp) {
        ontologies.push(tmp[cur].uri);
    }
    Session.set('listOnto', ontologies);
    return ontologies;
});

function align(ont1, ont2, binary){
    Meteor.call('align2ontos', ont1, ont2, binary,
            function(error, results) {
                console.log(results.content);
                return results.content;
            });
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
                Meteor.call('referenceFileFolder', ont1, ont2, reader.result,
                        function(err, results) {
                            align(ont1, ont2, binary);
                        });
            };
            reader.readAsBinaryString(referenceFile);
        } else {
            align(ont1, ont2, binary);
        }
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
