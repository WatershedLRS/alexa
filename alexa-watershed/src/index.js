'use strict';

var dotenv = require('dotenv');
var Alexa = require('alexa-sdk');
var TinCan = require('tincanjs');

dotenv.load();

var wsEndpoint = process.env.WS_ENDPOINT;
var wsUsername = process.env.WS_USERNAME;
var wsPassword = process.env.WS_PASSWORD;
var alexaAppId = ''; // optional
console.log('alexaAppId: ' + alexaAppId);

var welcomeOutput = 'Watershed is ready.';
var welcomeReprompt = 'Let me know what you want to do. ' +
    'You can say send test statement.';

var handlers = {
    'LaunchRequest': function() {
        this.emit(':ask', welcomeOutput, welcomeReprompt);
    },
    'SendTestStatementIntent': function() {
        var speechOutput = 'Sending test statement to Watershed. ';

        var statement = {
            actor: {
                mbox: 'mailto:alexa@foo.bar',
                name: 'Alexa'
            },
            verb: {
                id: 'http://activitystrea.ms/schema/1.0/send',
                display: {
                    'en-US': 'sent'
                }
            },
            target: {
                id: 'http://foo.bar/statement',
                definition: {
                    name: {
                        'en-US': 'test statement'
                    }
                }
            }
        };

        sendStatement(new TinCan.Statement(statement), function(result) {
            speechOutput += result;
            this.emit(':tell', speechOutput);
        }.bind(this));
    },
    'AMAZON.HelpIntent': function () {
        speechOutput = '';
        reprompt = '';
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function () {
        speechOutput = '';
        this.emit(':tell', speechOutput);
    },
    'AMAZON.StopIntent': function () {
        speechOutput = '';
        this.emit(':tell', speechOutput);
    },
    'SessionEndedRequest': function () {
        var speechOutput = '';
        this.emit(':tell', speechOutput);
    },
};

exports.handler = (event, context) => {
    var alexa = Alexa.handler(event, context);
    alexa.appId = alexaAppId;
    // To enabled string i18n features, set a resources object.
    //alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
}

function sendStatement(statement, callback) {
    // Connect to Watershed
    var lrs;

    try {
        lrs = new TinCan.LRS(
            {
                endpoint: wsEndpoint,
                username: wsUsername,
                password: wsPassword,
                allowFail: false
            }
        );
    } catch (ex) {
        console.log('Failed to setup LRS object: ' + ex);
        return;
    }

    // Save statement
    lrs.saveStatement(
        statement,
        {
            callback:  function (err, xhr) {
                function getResult() {
                    if (err !== null) {
                        if (xhr !== null) {
                            console.log ('Failed to save statement: ' + xhr.responseText + ' (' + xhr.status + ')');
                            return 'Failed to save statement.';
                        }
                        console.log ('Failed to save statement: ' + err);
                        return 'Failed to save statement.';
                    }
                    console.log ('Statement saved');
                    return 'Statement saved.';
                }
                callback(getResult());
            }
        }
    );
};
