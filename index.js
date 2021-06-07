import {findByProps as getModule} from "@goosemod/webpack"

const Aurora = {
	ready: false,
	updateTimer: undefined,
	json: {},
	lastJson: {},
	getCurrentUser: getModule('getUser', 'getUsers').getCurrentUser,
	getStatus: getModule('getApplicationActivity').getStatus,
	getChannel: getModule('getChannel').getChannel,
	getGuild: getModule('getGuild').getGuild,
	channels: getModule('getChannelId'),
	getSelectedGuild: () => {
		const channel = Aurora.getChannel(Aurora.channels.getChannelId())
		return channel ? Aurora.getGuild(channel.guild_id) : null;
	},
	getSelectedTextChannel() {
		return Aurora.getChannel(Aurora.channels.getChannelId());
	},
	getSelectedVoiceChannel() {
		return Aurora.getChannel(Aurora.channels.getVoiceChannelId());
	},
	getLocalStatus() {
		return Aurora.getStatus(Aurora.getCurrentUser().id);
	},
	sendJsonToAurora: async (json) => {
		fetch('http://localhost:9088/', {
			method: 'POST',
			body: JSON.stringify(json),
			mode: 'no-cors',
			headers: { 'Content-Type': 'application/json' }
		})
		.catch(error => console.log(`Aurora GSI error: ${error}`));
	},
	stop: () => {
		clearInterval(Aurora.updatetimer);
		console.log(`Aurora GSI stopped.`)
		Aurora.ready = false;
	}
}

const { getUser } = getModule('getUser'),
voice  = getModule('isMute', 'isDeaf', 'isSelfMute', 'isSelfDeaf'),
{ getCalls } = getModule('getCalls'),
{ getUnreadGuilds } = getModule('getUnreadGuilds'),
{ getTotalMentionCount } = getModule('getTotalMentionCount'),
isMute = voice.isMute.bind(voice),
isDeaf = voice.isDeaf.bind(voice),
isSelfMute = voice.isSelfMute.bind(voice),
isSelfDeaf = voice.isSelfDeaf.bind(voice);

export default {
	goosemodHandlers: {
		onImport: async () => {
			Aurora.json = {
				provider: {
					name: 'discord',
					appid: -1
				},
				user: {
					id: -1,
					status: 'undefined',
					self_mute: false,
					self_deafen: false,
					mentions: false,
					unread_messages: false,
					being_called: false
				},
				guild: {
					id: -1,
					name: ''
				},
				text: {
					id: -1,
					type: -1,
					name: ''
				},
				voice: {
					id: -1,
					type: -1,
					name: ''
				}
			};
		},

		onLoadingFinished: async () => {
			Aurora.updatetimer = setInterval(() => {
				const guild = Aurora.getSelectedGuild();
				const localUser = Aurora.getCurrentUser();
				const localStatus = Aurora.getLocalStatus();
				const textChannel = Aurora.getSelectedTextChannel();
				const voiceChannel = Aurora.getSelectedVoiceChannel();
	
				if (localUser && localStatus) {
					Aurora.json.user.id = localUser.id;
					Aurora.json.user.status = localStatus;
				} else {
					Aurora.json.user.id = -1;
					Aurora.json.user.status = '';
				}
	
				if (guild) {
					Aurora.json.guild.id = guild.id;
					Aurora.json.guild.name = guild.name;
				} else {
					Aurora.json.guild.id = -1;
					Aurora.json.guild.name = '';
				}
	
				if (textChannel) {
					Aurora.json.text.id = textChannel.id;
					if (textChannel.type === 0) { // text channel
						Aurora.json.text.type = 0;
						Aurora.json.text.name = textChannel.name;
					} else if (textChannel.type === 1) { // pm
						Aurora.json.text.type = 1;
						Aurora.json.text.name = getUser(textChannel.recipients[0]).username;
					} else if (textChannel.type === 3) { // group pm
						Aurora.json.text.type = 3;
						if (textChannel.name) {
							Aurora.json.text.name = textChannel.name;
						} else {
							let newname = '';
							for (let i = 0; i < textChannel.recipients.length; i++) {
								const user = textChannel.recipients[i];
								newname += `${getUser(user).username} `;
							}
							Aurora.json.text.name = newname;
						}
					}
				} else {
					Aurora.json.text.id = -1;
					Aurora.json.text.type = -1;
					Aurora.json.text.name = '';
				}
	
				if (voiceChannel) {
					if (voiceChannel.type === 1) { // call
						Aurora.json.voice.type = 1;
						Aurora.json.voice.id = voiceChannel.id;
						Aurora.json.voice.name = getUser(voiceChannel.recipients[0]).username;
					} else if (voiceChannel.type === 2) { // voice channel
						Aurora.json.voice.type = 2;
						Aurora.json.voice.id = voiceChannel.id;
						Aurora.json.voice.name = voiceChannel.name;
					}
				} else {
					Aurora.json.voice.id = -1;
					Aurora.json.voice.type = -1;
					Aurora.json.voice.name = '';
				}
	
				Aurora.json.user.self_mute = isSelfMute();
				Aurora.json.user.self_deafen = isSelfDeaf();
				Aurora.json.user.mute = isMute();
				Aurora.json.user.deafen = isDeaf();
	
				Aurora.json.user.unread_messages = false;
				Aurora.json.user.mentions = false;
				Aurora.json.user.being_called = false;
	
				Aurora.json.user.mentions = getTotalMentionCount();
				Aurora.json.user.unread_messages = Object.values(getUnreadGuilds()).length;
	
				if (getCalls().filter((x) => x.ringing.length > 0).length > 0) {
					Aurora.json.user.being_called = true;
				}
	
				if (JSON.stringify(Aurora.json) !== Aurora.lastJson) {
					Aurora.lastJson = JSON.stringify(Aurora.json);
					Aurora.sendJsonToAurora(Aurora.json);
				}
			}, 100);
		},

		onRemove: async () => {
			Aurora.stop();
		}
	}
};