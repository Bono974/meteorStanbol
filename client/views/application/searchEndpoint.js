Template.search.events({
    "click button[value=search]": function(event, t) {
        event.preventDefault();
        var pattern = t.$("form.search input[name=query]").val();
        var offset = 0;
        var limit = 100;
        Meteor.call('callAsyncQueryIndividualHDTFile', pattern, offset, limit, function(error, results) {
            console.log(results);
        });
    }
});

