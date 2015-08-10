QueryResult = new Mongo.Collection("queryResult");
HeaderResult = new Mongo.Collection("headerResult");
PredicatesResult = new Mongo.Collection("predicatesResult");
MappingsResult = new Mongo.Collection("mappingsResult");

QueryResultEntityRight = new Mongo.Collection("queryResultEntityRight");
QueryResultEntityLeft = new Mongo.Collection("queryResultEntityLeft");


var wrappedFind = Meteor.Collection.prototype.find;

Meteor.Collection.prototype.find = function() {
    var cursor = wrappedFind.apply(this, arguments);
    var collectionName = this._name;

    cursor.observeChanges({
        added: function(id, fields) {
            console.log(collectionName, 'added', id, fields);
        },
        changed: function(id, fields) {
            console.log(collectionName, 'changed', id, fields);
        },
        movedBefore: function(id, fields) {
            console.log(collectionName, 'movedBefore', id, fields);
        },
        removed: function(id, fields) {
            console.log(collectionName, 'removed', id, fields);
        }
    });
    return cursor;
};
