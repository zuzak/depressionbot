/**
 * Name: Users
 * Description: Track known users
 */
var users = function(dbot) {
    var knownUsers = dbot.db.knownUsers;
    var getServerUsers = function(event) {
        if(!knownUsers.hasOwnProperty(event.server)) {
            knownUsers[event.server] = { 'users': [], 'aliases': {} };
        }
        return knownUsers[event.server];    
    };

    var updateAliases = function(event, oldUser, newUser) {
        var knownUsers = getServerUsers(event);
        for(var alias in knownUsers.aliases) {
            if(knownUsers.aliases.hasOwnProperty(alias)) {
                if(knownUsers.aliases[alias] === oldUser) {
                    knownUsers.aliases[alias] = newUser;
                }
            }
        }
    }

    dbot.instance.addListener('366', 'users', function(event) {
        var knownUsers = getServerUsers(event);
        for(var nick in event.channel.nicks) {
            if(!knownUsers.users.include(nick) && !knownUsers.aliases.hasOwnProperty(nick) &&
                    event.channel.nicks.hasOwnProperty(nick)) {
                knownUsers.users.push(nick);
            }
        }
    });

    var commands = {
        '~alias': function(event) {
            var knownUsers = getServerUsers(event);
            var alias = event.params[1].trim();
            if(knownUsers.users.include(alias)) {
                var aliasCount = 0;
                knownUsers.aliases.each(function(primaryUser) {
                    if(primaryUser == alias) aliasCount += 1;
                }.bind(this));
                event.reply(dbot.t('primary', { 'user': alias, 'count': aliasCount })); 
            } else if(knownUsers.aliases.hasOwnProperty(alias)) {
                event.reply(dbot.t('alias', { 'alias': alias, 
                    'user': knownUsers.aliases[alias] }));
            } else {
                event.reply(dbot.t('unknown_alias', { 'alias': alias }));
            }
        },

        '~setaliasparent': function(event) {
            if(dbot.config.admins.include(event.user)) {
                var knownUsers = getServerUsers(event);
                var newParent = event.params[1];

                if(knownUsers.aliases.hasOwnProperty(newParent)) {
                    var newAlias = knownUsers.aliases[newParent]; 

                    // Replace users entry with new primary user
                    var usersIndex = knownUsers.users.indexOf(newAlias);
                    knownUsers.users[usersIndex] = newParent;

                    // Remove alias for new parent & add alias for new alias
                    delete knownUsers.aliases[newParent];
                    knownUsers.aliases[newAlias] = newParent;

                    // Update aliases to point to new primary user
                    updateAliases(event, newAlias, newParent);

                    event.reply(dbot.t('aliasparentset', { 'newParent': newParent, 
                        'newAlias': newAlias }));

                    dbot.modules.stats.fixStats(event.server, newAlias); // :'(
                } else {
                    event.reply(dbot.t('unknown_alias', { 'alias': newParent}));
                }
            }
        },

        '~mergeusers': function(event) {
            if(dbot.config.admins.include(event.user)) {
                var knownUsers = getServerUsers(event);
                var primaryUser = event.params[1];
                var secondaryUser = event.params[2];

                if(knownUsers.users.include(primaryUser) && knownUsers.users.include(secondaryUser)) {
                    knownUsers.users.splice(knownUsers.users.indexOf(secondaryUser), 1);  
                    knownUsers.aliases[secondaryUser] = primaryUser;
                    updateAliases(event, secondaryUser, primaryUser);

                    event.reply(dbot.t('merged_users', { 
                        'old_user': secondaryUser,
                        'new_user': primaryUser
                    }));
                } else {
                    event.reply(dbot.t('unprimary_error'));
                }
           } 
        }
    };

    return {
        'name': 'users',
        'ignorable': false,
        'commands': commands,
            
        'listener': function(event) {
            var knownUsers = getServerUsers(event); 
            if(event.action == 'JOIN') {
                if(!knownUsers.users.include(event.user)) {
                    knownUsers.users.push(event.user);
                }
            } else if(event.action == 'NICK') {
                var newNick = event.params.substr(1);
                if(knownUsers.aliases.hasOwnProperty(event.user)) {
                    knownUsers.aliases[newNick] = knownUsers.aliases[event.user];
                } else {
                    if(!knownUsers.users.include(newNick)) {
                        knownUsers.aliases[newNick] = event.user;
                    }
                }
            }
        },
        'on': ['JOIN', 'NICK'],
        
        'onLoad': function() {
            // Trigger updateNickLists to stat current users in channel
            var connections = dbot.instance.connections;
            for(var conn in connections) {
                if(connections.hasOwnProperty(conn)) {
                    connections[conn].updateNickLists();
                }
            }
        }
    };
};

exports.fetch = function(dbot) {
    return users(dbot);
};
