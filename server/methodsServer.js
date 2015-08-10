var stanbolURL = "http://localhost:8081";
var marmottaURL = "http://localhost:8080/marmotta";
var fusekiURL = "http://localhost:3030/testHDTFuseki/query";
var couchDBURL = "http://localhost"; var couchDBPORT = 5984;
var dbRessource = "ressources";

var referenceMeteorStanbol = settings.referenceMeteorStanbol;
var db = new(cradle.Connection)(couchDBURL, couchDBPORT).database(dbRessource);

var tempDirectoryToAnnotate = '../../../../../.uploads/toAnnotate/';

var ressourceStore = new FS.Store.FileSystem("ressources", {
  path: tempDirectoryToAnnotate
});

var hdtFilePath = settings.hdtFilePath;


var graphRDFMapping = "http://alignmentsGraph";
var graphRDFAnnotation = "http://localhost:8080/marmotta/context/alignementsTests"
var typeRessourceAnnotated = graphRDFAnnotation + "#ressourceAnnotated";
var PREFIX = "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>"; //TODO add more prefixes

function generateUID(separator) {
    var delim = separator || "-";
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return (S4() + S4() + delim + S4() + delim + S4() + delim + S4() + S4() + S4());
}

function xsdDateTime() {
    var date = new Date();

    var yyyy    = date.getFullYear();
    var mm1     = pad(date.getMonth()+1);
    var dd      = pad(date.getDate());
    var hh      = pad(date.getHours());
    var mm2     = pad(date.getMinutes());
    var ss      = pad(date.getSeconds());

    function pad(n) {
        var s = n.toString();
        return s.length < 2 ? '0'+s : s;
    }

    return yyyy + '-' + mm1 + '-' + dd + 'T' + hh + ':' + mm2 + ':' + ss;
}

function normaliseURItoFolderName(ont) {
    var res = ont.replace(/:/g, '');
    res = res.replace(/\//g, '~');

    return res;
}

function createFolderReference(folderName) {
    mkdirp(folderName, function (err) {
        if (err) console.error(err)
        //else console.log('pow!')
    });
}

function createFilesFolderReference(filePath, defined) { // ServOMap requirements (with no reference file)
    fs.open(filePath+".txt", 'w', function (err, fd) {
        fs.close(fd);
        if (!defined)
            fs.open(filePath+".rdf", 'w', function (err, fd) {
                fs.close(fd);
            });
    });
}

function uploadFileRef(filePath, fileData) { // ServOMap requirements (with reference file)
    fs.writeFile(filePath+".rdf", new Buffer(fileData));
}

function findTripleFromDoc(subject, predicate, graph, doc) {
    var docObj = JSON.parse(doc);
    var enhancement = docObj.enhancement;
    var strGraph = "@graph";
    var strID = "@id";
    var strEnhancerEntityReference = "enhancer:entity-reference";
    var strEntityReference = "entity-reference";

    var enhancementGraph = docObj.enhancement[strGraph];
    var res = "";

    for (var cur in enhancementGraph) { // FIXME : undefined...
        var tmp = enhancementGraph[cur][strEntityReference];
        if (typeof(tmp) != "undefined")
            res += subject + " " + predicate + " <" + enhancementGraph[cur][strEntityReference] + "> . ";
        else
            res += subject + " " + predicate + " <" + enhancementGraph[cur][strEnhancerEntityReference] + "> . ";
    }

    // Add attachment name as a triplet as well : Must be size 1, if not : retrieve for now the first attachment
    // FIXME : WARNING /!\ : UTF8 characters are not supported for the moment : to be verified
    var attachment = Object.keys(docObj["_attachments"]);

    // Suppose the repository / final query has a PREFIX for rdfs:<Thing>
    var predicateRdfsLabel = "rdfs:label";
    var predicateRdfsType = "rdfs:type";
    var attachmentTriple =  subject + " " + predicateRdfsLabel + " \"" + attachment + "\"@fr .";

    //console.log(attachmentTriple);

    var typeRessource = subject + " " + predicateRdfsType + "<" + typeRessourceAnnotated + ">";

    return {
        res: res,
        attachmentTriple: attachmentTriple,
        typeRessource: typeRessource
    };
}

function getURLRessourceCouchDBFromEntity(entity, ressourceNonAnnotated) {
    // FIXME : need to be more tested
    // Consider all ressource triples begin with a #
    var positionHashtag = entity.indexOf('#');
    var tmp = entity.substring(positionHashtag+1, entity.length);
    tmp = tmp.split('_');

    return couchDBURL + ":" + couchDBPORT + "/" + dbRessource + "/" + tmp[0] + "/" + ressourceNonAnnotated + "?rev=" + tmp[1];
}

Meteor.methods({
    getListOnto: function() {
        this.unblock();
        return HTTP.call("GET", marmottaURL+"/context/list?labels");
    }, referenceFileFolder: function(ont1, ont2, settings) {
        this.unblock();

        var uriFolder1 = normaliseURItoFolderName(ont1);
        var uriFolder2 = normaliseURItoFolderName(ont2);

        var folderTest1 = referenceMeteorStanbol + "/" + uriFolder1 + "_" + uriFolder2;
        var folderTest2 = referenceMeteorStanbol + "/" + uriFolder2 + "_" + uriFolder1;

        var res = {};

        // reference without extension : let uploadFileRef do it
        var res = Async.runSync(function (done) {
            fs.stat(folderTest1+"/reference.rdf", function(err, stat) {
                if(err == null) {
                    res = {
                        folder : folderTest1,
                        existed : true
                    };
                    if (typeof settings.referenceFileBuffer != "undefined")
                        uploadFileRef(res.folder+"/reference", settings.referenceFileBuffer);
                    done(null, res);
                } else if(err.code == 'ENOENT') {
                    fs.stat(folderTest2+"/reference.rdf", function(err, stat) {
                        if (err == null) {
                            res = {
                                folder : folderTest2,
                                existed : true
                            };
                            if (typeof settings.referenceFileBuffer != "undefined")
                                uploadFileRef(res.folder+"/reference", settings.referenceFileBuffer);
                            done(null, res);
                        } else if (err.code == 'ENOENT') {
                            res = {
                                folder : folderTest1,
                                existed : false
                            };
                            createFolderReference(folderTest1);

                            if (typeof settings.referenceFileBuffer != "undefined") {
                                createFilesFolderReference(folderTest1+"/reference", true);
                                uploadFileRef(res.folder+"/reference", settings.referenceFileBuffer);
                            } else
                                createFilesFolderReference(folderTest1+"/reference", false);
                            done(null, res);
                        } else {
                            console.log('Some other error: ', err.code);
                            res = {
                                err : err.code
                            };
                            done(null, res);
                        }
                    });
                } else {
                    console.log('Some other error: ', err.code);
                    res = {
                        err : err.code
                    };
                    done(null, res);
                }
            }
        )});
        return res;
    }, align2ontos: function(ont1, ont2, binary) {
        this.unblock();
        var onto1 = marmottaURL+"/export/download?context="+ont1+"&format=application%2Frdf%2Bxml";
        var onto2 = marmottaURL+"/export/download?context="+ont2+"&format=application%2Frdf%2Bxml";
        return HTTP.call("GET", stanbolURL+"/servomap/align/?ontology="+onto1+"&ontology="+onto2+"&binary="+binary);
    }, getAlignmentsO1O2: function(ont1, ont2, bool) {
        this.unblock();
        var res = Async.runSync(
                function(done) {
                    var settings = {
                        //referenceFileBuffer: null
                    };
                    Meteor.call("referenceFileFolder", ont1, ont2, settings, function(err, results) {
                        var res = "NULL";
                        if (results.result.existed) {
                            res = results.result.folder;
                            //console.log(res);
                            fs.stat(res+"/result.txt", function(err, stat) {
                                if (err == null)
                                    done(null, res+"/result.txt"); // Mapping exist -> show to client (string/JSON to visu)
                                else
                                    done(null, err.code);
                            });
                        }
                        else if (results.result.err) {
                            res = "ERROR 504";
                            done(null, res);
                        }
                    });
                });

        if (typeof(bool) != "undefined") // --> See putAlignmentsO1O2
            return res.result;

        if (res.result.search("result.txt") == -1)
            return "Erreur !";
        else {
            var resS = Async.runSync(
                    function(done) {
                        fs.readFile(res.result, 'utf-8', function(err, data) {
                            done(null, data);
                        });
                    });
            return resS.result;
        }
    }, putAlignmentsO1O2: function(ont1, ont2, settings){
        // put full result.txt into Marmotta
        // FIXME TODO : choose a good name for ont1/ont2 contexts
        // TODO : test if alignments are already in repository (versionning ?)
        this.unblock();

        var res = Async.runSync(
                function(done) {
                    Meteor.call('getAlignmentsO1O2', ont1, ont2, true, function(err, results) {
                        if (results.search("result.txt") == -1) // No result file
                            return;


                        var resultFile = results;

                        var date            = xsdDateTime();
                        var graph           = graphRDFMapping;
                        var author          = settings.author;
                        var tool            = settings.tool; // ServOMap / LogMap / Manual
                        var authorID        = author; // For now ?
                        var onto1ID         = "<" + ont1 + ">"; // For now ?
                        var onto2ID         = "<" + ont2 + ">"; // For now ?
                        var onto1URI        = ont1;
                        var onto2URI        = ont2;
                        var alignmentID     = "alignment_" + ont1 + "_" + ont2;
                        var alignmentURI    = "<" + graph + "#" + alignmentID + ">";
                        var authorURI       = "<" + graph + "#" + authorID + ">";

                        var triples1 =      authorURI + " rdfs:subClassOf align:Agent ." +
                                            authorURI + " rdfs:label \""+ author + "\" . " +
                                            alignmentURI + " rdfs:subClassOf align:Alignment ." +
                                            alignmentURI + " align:has_author " + authorURI + " . " +
                                            alignmentURI + " align:has_tool align:" + tool + " . " +
                                            onto1ID + " rdfs:subClassOf align:Ontology ." +
                                            onto2ID + " rdfs:subClassOf align:Ontology ." +
                                            onto1ID + " align:has_location \"" + onto1URI + "\" . " +
                                            onto2ID + " align:has_location \"" + onto2URI + "\" . " +

                                            onto1ID + " align:has_alignment "+ alignmentURI + " ." +
                                            onto2ID + " align:has_alignment "+ alignmentURI + " ." +
                                            alignmentURI + " align:tool_date \"" + date +  "\"^^xsd:dateTime . ";

                        var queryHeader =
                            "PREFIX align:<" + graph + "#> "+
                            " INSERT DATA {" +
                            "	GRAPH <" + graph + "> " +
                            "{" +
                            triples1 +
                            "}"+
                            "}";
                        var res = Async.runSync(
                                function(done) {
                                    fs.readFile(resultFile, 'utf-8', function(err,data) {
                                        var triplesArray = [""];
                                        var i = 0;

                                        var fileArray = data.split('\n');
                                        for (var cur in fileArray) {
                                            var currentMapping = fileArray[cur].split(';');

                                            var e1 = currentMapping[0];
                                            var e2 = currentMapping[1];

                                            if (e1 === "" || e2 === "")
                                                continue;

                                            var relation = " align:Equivalent "; //for now : "align:Equivalent"
                                            var measure = currentMapping[2];

                                            var mappingID = generateUID(); //e1 + e2;

                                            e1 = "<" + e1 + ">";
                                            e2 = "<" + e2 + ">";

                                            var mappingURI = "<" + graph + "#" + mappingID + ">";

                                            var pos = triplesArray.length - 1;

                                            triplesArray[pos] += alignmentURI   + " align:has_mapping "     + mappingURI + " . ";
                                            triplesArray[pos] += mappingURI     + " rdfs:subClassOf "       + " align:Mapping . ";
                                            triplesArray[pos] += mappingURI     + " align:has_entity1 "     + e1 + " . ";
                                            triplesArray[pos] += mappingURI     + " align:has_entity2 "     + e2 + " . ";
                                            triplesArray[pos] += mappingURI     + " align:has_relation "    + relation + " . ";
                                            triplesArray[pos] += mappingURI     + " align:has_measure \""   + measure + "\" . ";

                                            triplesArray[pos] += e1 + " rdfs:subClassOf align:Entity . ";
                                            triplesArray[pos] += e2 + " rdfs:subClassOf align:Entity . ";
                                            triplesArray[pos] += e1 + " align:has_mapping " + mappingURI + " . ";
                                            triplesArray[pos] += e2 + " align:has_mapping " + mappingURI + " . ";
                                            triplesArray[pos] += mappingURI     + " align:has_author " + authorURI  + " . ";
                                            triplesArray[pos] += mappingURI     + " align:human_validation \"false\" . ";
                                            triplesArray[pos] += mappingURI     + " align:validation_date \"" + date +  "\"^^xsd:dateTime . ";

                                            i++;
                                            if (i % 10 == 0) {
                                                triplesArray.push("");
                                            }
                                        }
                                        done(null, triplesArray);
                                    })
                                });
                        var triplesArray = res.result;
                        var titi = Async.runSync(
                                function(done) {
                                    //console.log("Header incoming");
                                    Meteor.call('queryUpdateMarmotta', queryHeader, function(err, results) {
                                        //console.log("Header added");
                                        if (err) console.log(err);
                                        var queryTriples = [];
                                        for (var cur in triplesArray) {
                                            var triples = triplesArray[cur];
                                            queryTriples.push(
                                                "PREFIX align:<" + graph + "#> " +
                                                " INSERT DATA {" +
                                                "   GRAPH <" + graph + ">" +
                                                "   {" +
                                                triples +
                                                "   }" +
                                                "}");
                                        }
                                        done(null, queryTriples);
                                    });
                                });
                        done(null, titi.result);
                    });
                });

        var triplesToAdd = res.result;

        var endpoint = marmottaURL+'/sparql/update';
        var sparql = Meteor.npmRequire('sparql-client');
        var client = new sparql(endpoint);

        precompute(0, triplesToAdd.length);

        function precompute(iterations_min, iterations_max) {
            var i = 0;
            while((iterations_max-iterations_min) != 0 && i < 10) {
                var lock = Async.runSync(
                        function(done) {
                            client.query(triplesToAdd[iterations_min]).execute(function (error, results) {
                                done(null, "end :"+iterations_min);
                            });
                        });
                iterations_min++;
                i++;
            }
            if (iterations_min == iterations_max) {
                //console.log("DONE");
                return;
            }
            if (iterations_min < iterations_max ) { // FIXME
                Meteor.bindEnvironment(setTimeout(Meteor.bindEnvironment(function(){
                    Meteor.bindEnvironment(precompute(iterations_min, iterations_max));
                }), 0));
            }
        }
    }, querySelectMarmotta: function(queryS){
        var endpoint = marmottaURL+'/sparql/select';
        var res = Async.runSync(
                function(done) {
                    Meteor.call('query', endpoint, queryS, function(err, results) {
                        done(null, results);
                    })
                });
        return res.result;
    }, queryUpdateMarmotta: function(queryU) {
        var endpoint = marmottaURL+'/sparql/update';
        Meteor.call('query', endpoint, queryU);
    }, querySelectFuseki: function(queryS) {
        var endpoint = fusekiURL;
        var res = Async.runSync(
                function(done) {
                    Meteor.call('query', endpoint, queryS, function(err, results) {
                        done(null, results);
                    })
                });
        return res.result;
    }, query: function(endpoint, query) {
        //var query = "SELECT * FROM <http://human.owl> WHERE {?s rdfs:subClassOf ?o} LIMIT 10";
        var result = Async.runSync(
                function(done) {
                    var urlQuery = endpoint + "?query=" + escape(query) + "&output=json";
                    //var urlQuery = endpoint + "?query=" + encodeURIComponent(query) + "&output=json";
                    HTTP.call("GET", urlQuery, function(err, results) {
                        //console.log(err);
                        if (results == null) {
                            //console.log(err);
                            done(null, 'end');
                            return;
                        }
                        var res = results.content;
                        if (res === null) {
                            done(null, "end");
                            return;
                        }
                        else if (res === '') {
                            done(null, "end");
                            return;
                        }
                        //console.log(res === '');
                        res = JSON.parse(res);
                        done(null, res);
                    });
                });
        return result.result;
    }, getMetaOnto: function(onto) {
        this.unblock();
        var marmottaExportOntology = marmottaURL+"/export/download?context="+onto+"&format=application%2Frdf%2Bxml";
        return HTTP.call("GET", stanbolURL+"/servomap/meta/?ontology="+marmottaExportOntology);
    }, addEnhancementsToRepo: function(filename) {
        var query = Async.runSync(
                function(done) {
                    db.get(filename, function (err, doc) { //Doc here exist
                        var graph = graphRDFAnnotation;
                        var subject = "<" + graph + "#" + doc._id + '_' + doc._rev + ">"; // FIXME : temporary ?
                        var predicate = "<" + graph + "#annotePar>";
                        var triples = findTripleFromDoc(subject, predicate, graph, doc);
                        var queryEnhancements = PREFIX +
                        "INSERT DATA  " +
                        "{"+
                        "    GRAPH <"+ graph +">" +
                        "    {"+
                                triples.res +
                        "    }"+
                        "}";
                        var queryAttachment = PREFIX +
                        "INSERT DATA " +
                        "{"+
                        "    GRAPH <"+ graph +">" +
                        "    {"+
                                triples.attachmentTriple +
                        "    }"+
                        "}";
                        var queryType = PREFIX +
                        "INSERT DATA " +
                        "{"+
                        "    GRAPH <"+ graph +">" +
                        "    {"+
                                triples.typeRessource +
                        "    }"+
                        "}";

                        var res = {
                            queryEnhancements: queryEnhancements,
                            queryAttachment: queryAttachment,
                            queryType: queryType
                        };
                        done(null, res);
                    })
                });
        Meteor.call('queryUpdateMarmotta', query.result.queryEnhancements, function(err, results) {
            if (err) console.log(err);
            else {
                Meteor.call('queryUpdateMarmotta', query.result.queryAttachment, function(err, results) {
                    if (err) console.log(err);
                    else {
                        Meteor.call('queryUpdateMarmotta', query.result.queryType, function(err, results) {
                            if (err) console.log(err);
                        });
                    }
                });
            }
        });
    }, testIfRessourceFromRepo: function(entity) {
        this.unblock();

        var queryType = PREFIX +
                        "SELECT *"+
                        "WHERE {"+
                            "<" + entity + "> rdfs:type ?object"+
                        "}";
        var queryLabel = PREFIX +
                        "SELECT *"+
                        "WHERE {"+
                            "<" + entity + "> rdfs:label ?object"+
                        "}";
        var res = Async.runSync(
                function(done) {
                    Meteor.call('querySelectMarmotta', queryType, function(err, results) {
                        var res = results.results.bindings;
                        if (typeof(res[0]) != "undefined")
                            if (typeof(res[0].object) != "undefined")
                                if (res[0].object.value === typeRessourceAnnotated) {

                                    Meteor.call('querySelectMarmotta', queryLabel, function(err, results) {
                                        var res = results.results.bindings;
                                        var ressourceNonAnnotated = res[0].object.value;
                                        var urlRessource = getURLRessourceCouchDBFromEntity(entity, ressourceNonAnnotated);

                                        done(null, urlRessource);
                                        return;
                                    });
                                    return;
                                }
                        done(null, "N'est pas une ressource");
                    });
                });
        return res.result;
    }, addOntology: function(onto, format) {
        this.unblock();
        // NO NEED : Client
    }, deleteOnto: function(onto) {
        this.unblock();
        return HTTP.call("DELETE", marmottaURL+"/context/?graph="+onto)
    }, getMetaRessource: function(ressourceID) {
        this.unblock();
    }, getListRessources: function() {
        this.unblock();
        var allDocs =  HTTP.call("GET", couchDBURL+":"+couchDBPORT+"/"+dbRessource+"/_all_docs");
        var res = JSON.parse(allDocs.content);
        return res;
    }, fileUpload:function (filename, fileData) {
        var filePath = tempDirectoryToAnnotate + filename;
        //console.log(filePath);
        fs.writeFile(filePath, new Buffer(fileData));
    }, getRessource: function(filename) {
        var res = Async.runSync(
                function(done) {
                    db.get(filename, function (err, doc) {
                        if (typeof doc != "undefined") {
                            bool = true;
                            res = { // FIXME Get author with view
                                id : doc._id,
                                rev : doc._rev,
                                doc : doc
                            };
                            done(null, res);
                        }
                    });
                });
        return res.result;
    }, checkRessource: function(filename) {
        var res; //FIXME init
        var bool = false;
        db.get(filename, function (err, doc) {
            if (typeof doc != "undefined") {
                bool = true;
                res = { // FIXME Get author with view
                    checked: true,
            id : doc._id,
            rev : doc._rev
                };
            }
        });
        if (!bool)
            res = { checked: false };

        //console.log("CHECK RESSOURCE");
        //console.log(res);
        return res;
    }, addRessourceAnnotated: function(filename, author, extendedRessource, enhancement) {
        this.unblock();

        //console.log("ADD RESSOURCE");
        db.save(filename, {
            filename: filename,
            author: author,
            enhancement : enhancement
        }, Meteor.bindEnvironment(function (err, res) {
            if (err) console.log(err);
            //else console.log(res);

            var id = res.id;
            var rev = res.rev;

            //console.log(filename);
            Meteor.call("addAttachment",
                    filename,
                    author,
                    rev,
                    id,
                    extendedRessource,
                    function(errors, results) {
//                        console.log("Document à modifier: " + filename + " rev: " + rev + " id:" + id);
//                        console.log("Auteur: " + author);
//                        console.log("HTML5 input file: " + extendedRessource);
//                        console.log("------------");
                    });
        }));
    }, addAttachment: function(filename, author, rev, id, ressource) {
        this.unblock();

        var doc = {
            _id: id,
            _rev: rev
        };
        var idData = {
            id: doc._id,
            rev: doc._rev
        };
        //console.log("ADD ATTACHMENT");
        //console.log(doc);
        //console.log(ressource);

        var filePath = tempDirectoryToAnnotate + ressource.name;
        //console.log("FILEPATH" + filePath);
        var readStream = fs.createReadStream(filePath);

        var attachmentData = {
            name: ressource.name,
            'Content-Type': ressource.type
        };
        var writeStream = db.saveAttachment(idData,
                attachmentData,
                function (err, reply) {
                    if (err) {
                        console.dir(err);
                        return;
                    }
                    //console.dir(reply);
                });
        readStream.pipe(writeStream);
    }, getRevDocument: function(ressource) {
        return HTTP.call("HEAD",
                couchDBURL+":"+couchDBPORT+"/"+dbRessource+"/"+ressource);
    }, deleteRessource: function(ressource) {
        this.unblock();

        var temp = Meteor.call('getRevDocument', ressource);
        var rev = temp.headers.etag.replace(/['"]+/g, '');
        return HTTP.call("DELETE",
                couchDBURL+":"+couchDBPORT+"/"+dbRessource+"/"+ressource+"?rev="+rev);
    }, updateEnhancementAndRessource: function(settings, enhancement, extendedRessource) {
        this.unblock();
        db.save(settings.id, settings.rev,
                {   author: settings.author,
                    filename: settings.filename,
                    enhancement: enhancement },
                    Meteor.bindEnvironment(function (err, res) {
                        //console.log(res);
                        Meteor.call("updateRessource",
                                settings.id,
                                res.rev,
                                settings.filename,
                                settings.author,
                                extendedRessource,
                                function(errors, results) {
                                    //console.log(errors);
                                    //console.log(results);
                                }); //FIXME : check if same ressource
                    }));
    }, updateRessource: function(id, rev, filename, author, extendedRessource) {
        this.unblock(); // FIXME Delete existing ressource
        Meteor.call("addAttachment",
                filename,
                author,
                rev,
                id,
                extendedRessource,
                function(errors, results) { });
    }, callAsyncQueryHDTFile: function (subject, predicate, object, offset, limit) {
        this.unblock();
        var hdt = Meteor.npmRequire('hdt');

        var res = Async.runSync(
                function(done) {
                    hdt.fromFile(hdtFilePath, function(error, hdtDocument) {
                        //console.log(error);
                        hdtDocument.searchTriples(subject, predicate, object, {offset:0, limit:limit},
                            function(error, triples, totalCount){
                                //console.log(triples);
                                //triples.forEach(function(triple) {
                                //    console.log(triple);
                                //});
                                hdtDocument.close();
                                done(null, triples);
                            });
                    })
                });
        return res.result;
    }, callAsyncQueryIndividualHDTFile: function (pattern, offset, limit) {
        this.unblock();
        var hdt = Meteor.npmRequire('hdt');

        var res = Async.runSync(
                function(done) {
                    hdt.fromFile(hdtFilePath, function(error, hdtDocument) {
                        //console.log(error);
                        hdtDocument.searchLiterals(pattern, {offset:offset, limit:limit},
                            function(error, literals, totalCount){
                                //console.log(error);
                                //console.log(literals);
                                hdtDocument.close();
                                done(null, literals);
                            });
                    })
                });
        return res.result;
    }, getEntitiesByPredicate: function(currentEntity, predicate) {
        this.unblock();
        var query =
            "SELECT *"+
            "WHERE {"+
             "<" + currentEntity +  "> <" + predicate + "> ?object"+
             "}";
        Meteor.call("getSPARQLResultUser", query);
    }, updateCurrentEntityMetadata: function(currentEntity) {
        this.unblock();

        var uriEntity;
        if (entityIsIndividual(currentEntity))
            uriEntity = "\"" + currentEntity + "\"";
        else
            uriEntity = "<" + currentEntity + ">";

        var queryPredicates =
            "SELECT DISTINCT ?predicate "+
            "WHERE {"+
                uriEntity + " ?predicate ?object"+
            "}";
        var queryMappings =
            "PREFIX align:<http://alignmentsGraph#>"+
            "SELECT *"+
            "WHERE {"+
                uriEntity + " align:has_mapping ?subject ."+
                "?subject ?test ?mapping ."+
                "FILTER (?test in (align:has_entity1, align:has_entity2))."+
                "FILTER (?mapping!=" + uriEntity + ")."+
            "}" ;

        var queryRight =
            "SELECT * "+
            "WHERE {"+
                uriEntity + " ?predicate ?object"+
            "}";
        var queryLeft =
            "SELECT * "+
            "WHERE {"+
                "?subject ?predicate "+ uriEntity+
            "}";
        var predicates = Async.runSync(
                function(done) {
                    Meteor.call("querySelectMarmotta", queryPredicates, function(err, results) {
                        if (typeof(results.results) != "undefined") {
                            var predicates = results.results.bindings;
                            done(null, predicates);
                        }
                    });
                }).result;
        var mappings = Async.runSync(
                function(done) {
                    Meteor.call("querySelectMarmotta", queryMappings, function(err, results) {
                        if (typeof(results.results) != "undefined") {
                            var mappings = results.results.bindings;
                            done(null, mappings);
                        }
                    });
                }).result;
        var right = Async.runSync(
                function(done) {
                    Meteor.call("querySelectMarmotta", queryRight, function(err, results) {
                        if (typeof(results.results) != "undefined") {
                            var right = results.results.bindings;
                            done(null, right);
                        }
                    });
                }).result;
        var left = Async.runSync(
                function(done) {
                    Meteor.call("querySelectMarmotta", queryLeft, function(err, results) {
                        if (typeof(results.results) != "undefined") {
                            var left = results.results.bindings;
                            done(null, left);
                            updateCurrentEntity(predicates, mappings, right, left);
                        }
                    });
                }).result;

    }, getSPARQLResultUser: function(query) {
        this.unblock();

        var result = Async.runSync(
                function(done) {
                    Meteor.call("querySelectMarmotta", query, function(err, results) {
                        updateHeaderGResultsDB(results);
                        done(null, results);
                    });
                });
        return result.result;
    }, getEntityLabel: function(entity) {
        this.unblock();
        //TODO : if entity is from a SKOS voc, then use skos:prefLabel / skos:altLabel

        var query = "SELECT ?label WHERE {<"+ entity +"> rdfs:label ?label}";
        //var query = "SELECT ?label WHERE {<"+ entity +"> skos:prefLabel ?label}";
        //var query = "SELECT ?label WHERE {<"+ entity +"> skos:altLabel ?label}";

        var result = Async.runSync(
                function(done) {
                    Meteor.call("querySelectMarmotta", query, function(err, results) {
                        var label = "No label";
                        if (typeof(results.results.bindings[0]) != "undefined")
                            label = results.results.bindings[0].label.value;
                        done(null, label);
                    });
                });
        return result.result;
    }
});

//FIXME : may be not useful from now
Meteor.startup(function () {
    UploadServer.init({
        tmpDir:"../../../../../.uploads/tmp",
        uploadDir:"../../../../../.uploads/"
    });

    QueryResult.remove({});
    HeaderResult.remove({});
    PredicatesResult.remove({});
    MappingsResult.remove({});
    QueryResultEntityRight.remove({});
    QueryResultEntityLeft.remove({});
});

function entityIsIndividual(entity) {
    if (entity == null)
        return false;
    if (entity.search("http://") == -1)
        return true;
    return false;
}
// push dataset result into mongodb collection
function updateHeaderGResultsDB(datasetSPARQL) {
    HeaderResult.remove({});
    QueryResult.remove({});

    var headers = datasetSPARQL.head.vars;
    var results = datasetSPARQL.results.bindings;

    for (var cur in headers) {
        HeaderResult.insert({header: headers[cur]});
    }
    for (var cur in results) {
        var tmp = [];
        tmp.push(results[cur]);
        QueryResult.insert({res: tmp});
    }
}

function updateCurrentEntity(predicates, mappings, right, left) {
    PredicatesResult.remove({});
    MappingsResult.remove({});
    QueryResultEntityRight.remove({});
    QueryResultEntityLeft.remove({});

    for (var cur in predicates)
        PredicatesResult.insert({predicate: predicates[cur].predicate.value});
    for (var cur in mappings)
        MappingsResult.insert({mappings: mappings[cur].mapping.value});

    var right = right || [];
    var left = left || [];

    for (var cur in right) {
        var tmp2 = {
            predicate: right[cur].predicate.value,
            object: right[cur].object.value
        };
        //tmp.push(tmp2);
        QueryResultEntityRight.insert(tmp2);
    }

    for (var cur in left) {
        var tmp2 = {
            subject: left[cur].subject.value,
            predicate: left[cur].predicate.value
        };
        //tmp.push(tmp2);
        QueryResultEntityLeft.insert(tmp2);
    }
    //console.log('right', right);
    //console.log('left', left);
    //console.log('mappings', mappings);
    //console.log('predicates', predicates);
}

Meteor.publish(
    "resultSPARQL", function(cursor) {
        return QueryResult.find({}, {limit:20, skip:cursor});
});
Meteor.publish(
    "resultSPARQLHeaders", function() {
        return HeaderResult.find({});
});
Meteor.publish(
    "resultSPARQLPredicates", function() {
        return PredicatesResult.find({});
});
Meteor.publish(
    "resultSPARQLMappings", function(cursor) {
        var cursor = cursor || 0;
        return MappingsResult.find({}, {limit:20, skip:cursor});
});
Meteor.publish(
    "resultSPARQLEntityRight", function(cursor) {
        return QueryResultEntityRight.find({}, {limit:20, skip:cursor});
});
Meteor.publish(
    "resultSPARQLEntityLeft", function(cursor) {
        return QueryResultEntityLeft.find({}, {limit:20, skip:cursor});
});
