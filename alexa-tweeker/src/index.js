'use strict';

var dotenv = require('dotenv');
var Alexa = require('alexa-sdk');
var TinCan = require('tincanjs');
var _ = require('lodash');

dotenv.load();

var wsEndpoint = process.env.WS_ENDPOINT;
var wsUsername = process.env.WS_USERNAME;
var wsPassword = process.env.WS_PASSWORD;
var alexaAppID = ''; // optional

var reprompt;
var welcomeOutput = 'Who had the tweeker?';
var welcomeReprompt = 'Let me know which two people had the tweeker. ' +
    'You can also tell me what the tweeker was about.';

var emailDomain = 'watershedlrs.com';

var handlers = {
    'LaunchRequest': function() {
        this.emit(':ask', welcomeOutput, welcomeReprompt);
    },
    'Tweeker': function() {
        var speechOutput;

        // Check dialog state and if not completed, have Alexa ask
        // for required slots.
        if (this.event.request.dialogState !== "COMPLETED") {
            this.emit(":delegate");
            return;
        }

        // Figure out who had a tweeker
        var mentorFirstName = this.event.request.intent.slots.mentorFirstName.value;
        var mentorLastName = this.event.request.intent.slots.mentorLastName.value;
        var mentorFullName = createFullName(mentorFirstName, mentorLastName);
        var mentorEmail = createCompanyEmail(mentorFirstName, mentorLastName, emailDomain);

        var menteeFirstName = this.event.request.intent.slots.menteeFirstName.value;
        var menteeLastName = this.event.request.intent.slots.menteeLastName.value;
        var menteeFullName = createFullName(menteeFirstName, menteeLastName);
        var menteeEmail = createCompanyEmail(menteeFirstName, menteeLastName, emailDomain);

        speechOutput = mentorFullName + ' had a tweeker with ' + menteeFullName;

        var tweekerTopic = isSlotValid(this.event.request, 'tweekerTopic');
        if (tweekerTopic) {
            speechOutput += ' about ' + tweekerTopic;
        }

        speechOutput += '. ';

        var statement = {
            actor: {
                mbox: mentorEmail,
                name: mentorFullName
            },
            verb: {
                id: 'http://id.tincanapi.com/verb/mentored',
                display: {
                    'en-US': 'mentored'
                }
            },
            target: {
                mbox: menteeEmail,
                name: menteeFullName,
                objectType: 'Agent'
            }
        };

        if (tweekerTopic) {
            statement.context = {
                contextActivities: {
                    category: [
                        {
                            id: 'https://watershedlrs.com/alexa-prototype/topics/' + tweekerTopic,
                            definition: {
                                type: 'http://id.tincanapi.com/activitytype/category',
                                name: {
                                    en: tweekerTopic
                                }
                            }
                        }
                    ]
                }
            };
        }

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
    alexa.appId = alexaAppID;
    // To enabled string i18n features, set a resources object.
    //alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

function isSlotValid(request, slotName) {
    var slot = request.intent.slots[slotName];
    //console.log("request = "+JSON.stringify(request)); //uncomment if you want to see the request
    var slotValue;

    // if we have a slot, see if there is a value
    if (slot && slot.value) {
        // we have a value in the slot
        slotValue = slot.value.toLowerCase();
        return slotValue;
    } else {
        // we don't have a value in the slot
        return false;
    }
}

function createFullName(fName, lName) {
    return _.capitalize(fName) + ' ' + _.capitalize(lName);
}

function createCompanyEmail(fName, lName, eDomain) {
    return _.lowerCase(fName) + '.' + _.lowerCase(lName) + '@' + eDomain;
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
}
