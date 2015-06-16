Router.configure({
    layoutTemplate: 'mainLayout'
});

Router.route('/', {
    name: 'accueil',
    template: 'accueil',
    //action: function(){
	//	Session.set("title", "App RESTful / Meteor" );
	//}
});


Router.route('/servomap', {
    name: 'servomap'
});


Router.route('/repositoryOnto', {
    name: 'repositoryOnto'
});

Router.route('/repositoryRessource', {
    name: 'repositoryRessource'
});

Router.route('/repositoryOnto/:_onto', {
    name: 'repositoryOntoMeta',
    template: 'repositoryOnto',
    data: function() {
        return {
            onto: this.params._onto
        }
    }
});

Router.route('/search', {
    name: 'search'
});