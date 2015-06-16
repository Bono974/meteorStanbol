Template.mainLayout.helpers({
    "setTitle": function(){
		if(Session.get('title')){
			document.title = Session.get('title');
		}
	}
});
