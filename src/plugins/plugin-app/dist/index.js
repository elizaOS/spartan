// src/actions/act_reg_start.ts
import {
  createUniqueUuid as createUniqueUuid2
} from "@elizaos/core";

// ../../node_modules/uuid/dist/esm/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// ../../node_modules/uuid/dist/esm/rng.js
import { randomFillSync } from "crypto";
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// ../../node_modules/uuid/dist/esm/native.js
import { randomUUID } from "crypto";
var native_default = { randomUUID };

// ../../node_modules/uuid/dist/esm/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// src/actions/act_reg_start.ts
import nodemailer from "nodemailer";

// src/utils.ts
import {
  createUniqueUuid,
  logger
} from "@elizaos/core";
async function messageReply(runtime, message, reply, responses) {
  const roomDetails = await runtime.getRoom(message.roomId);
  if (message.content.source === "discord") {
    const discordService = runtime.getService("discord");
    if (!discordService) {
      logger.warn("no discord Service");
      return;
    }
    const isDM = roomDetails.type === "dm";
    if (isDM) {
      discordService.sendDM(message.metadata.authorId, reply);
      responses.length = 0;
    } else {
      responses.length = 0;
      const entityId = createUniqueUuid(runtime, message.metadata.authorId);
      responses.push({
        entityId,
        agentId: runtime.agentId,
        roomId: message.roomId,
        content: {
          text: reply,
          attachments: [],
          inReplyTo: createUniqueUuid(runtime, message.id)
        }
        // embedding
        // metadata: entityName, type, authorId
      });
    }
    return true;
  }
  logger.warn("unknown platform", message.content.source);
  return false;
}
function takeItPrivate(runtime, message, reply) {
  if (message.content.source === "discord") {
    const discordService = runtime.getService("discord");
    if (!discordService) {
      logger.warn("no discord Service");
      return;
    }
    discordService.sendDM(message.metadata.authorId, reply);
    return true;
  }
  logger.warn("unknown platform", message.content.source);
  return false;
}

// src/constants.ts
var EMAIL_TYPE = "trader_email_v0";
var SPARTAN_SERVICE_TYPE = "spartan_services";

// src/actions/act_reg_start.ts
var transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  // e.g. smtp.gmail.com, smtp.mailgun.org
  port: parseInt(process.env.SMTP_PORT) || 587,
  // 587 for TLS, 465 for SSL
  secure: false,
  // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USERNAME,
    // your SMTP username
    pass: process.env.SMTP_PASSWORD
    // your SMTP password or app password
  }
});
function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charsLength = chars.length;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }
  return result;
}
function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches || [];
}
async function sendVerifyEmail(address, regCode) {
  console.log("sending verify email to", address);
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: address,
    subject: "Welcome to Spartan Services",
    //text: 'Please click the following link to verify you are the owner of this email and continue registration'
    text: "Please give Spartan the following code: " + regCode
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.envelope);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
var userRegistration = {
  name: "USER_REGISTRATION",
  similes: [],
  validate: async (runtime, message) => {
    if (!message.metadata.authorId) return false;
    const entityId = createUniqueUuid2(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    const email = entity.components.find((c) => c.type === EMAIL_TYPE);
    console.log("reg_start:validate - are signed up?", !!email);
    return !email;
  },
  description: "Allows a user to start user registration",
  handler: async (runtime, message, state, _options, callback, responses) => {
    console.log("USER_REGISTRATION handler");
    const roomDetails = await runtime.getRoom(message.roomId);
    console.log("roomDetails", roomDetails);
    const roomEntity = await runtime.getEntityById(message.roomId);
    console.log("roomEntity", roomEntity);
    const agentEntityId = createUniqueUuid2(runtime, runtime.agentId);
    const agentEntity = await runtime.getEntityById(agentEntityId);
    console.log("agentEntity", agentEntity);
    let spartanData = agentEntity.components.find((c) => c.type === SPARTAN_SERVICE_TYPE);
    let spartanDataNew = false;
    let spartanDataDelta = false;
    if (!spartanData) {
      spartanDataNew = true;
      spartanData.data = {
        users: []
      };
    }
    const entityId = createUniqueUuid2(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    console.log("entity", entity);
    const email = entity.components.find((c) => c.type === EMAIL_TYPE);
    console.log("email", email);
    const emails = extractEmails(message.content.text);
    console.log("would have responded", responses);
    console.log("emails in message", emails.length);
    if (emails.length > 1) {
      if (email) {
        console.log("Write overlap");
      } else {
        takeItPrivate(runtime, message, "What email address would you like to use for registration");
        responses.length = 0;
      }
    } else if (emails.length === 1) {
      const isLinking = spartanData.users.includes(email[0]);
      if (isLinking) {
        console.log("this email is already used else where", isLinking);
      } else {
        const regCode = generateRandomString(16);
        console.log("sending", regCode, "to email", emails[0]);
        await runtime.createComponent({
          id: v4_default(),
          agentId: runtime.agentId,
          worldId: roomDetails.worldId,
          roomId: message.roomId,
          sourceEntityId: message.entityId,
          entityId,
          type: EMAIL_TYPE,
          data: {
            address: emails[0],
            code: regCode,
            verified: false
          }
        });
        spartanDataDelta = true;
        spartanData.data.users.push(entityId);
        await sendVerifyEmail(emails[0], regCode);
        takeItPrivate(runtime, message, "I just sent you an email (might need to check your spam folder) to confirm " + emails[0]);
        responses.length = 0;
      }
      async function updateSpartanData(agentEntityId2, spartanData2) {
        if (spartanDataNew) {
          await runtime.createComponent({
            id: v4_default(),
            agentId: runtime.agentId,
            worldId: roomDetails.worldId,
            roomId: message.roomId,
            sourceEntityId: entityId,
            entityId: agentEntityId2,
            type: SPARTAN_SERVICE_TYPE,
            data: spartanData2.data
          });
        } else {
          await runtime.updateComponent({
            id: spartanData2.id,
            // do we need all these fields?
            //agentId: runtime.agentId,
            //worldId: roomDetails.worldId,
            //roomId: message.roomId,
            //sourceEntityId: entityId,
            //entityId: entityId,
            //type: SPARTAN_SERVICE_TYPE,
            data: spartanData2.data
          });
        }
      }
      if (spartanDataDelta) {
        updateSpartanData(agentEntityId, spartanData);
      }
    } else {
      if (email) {
        takeItPrivate(runtime, message, "Do you want to use " + email + " for registration?");
        responses.length = 0;
      } else {
        takeItPrivate(runtime, message, "What email address would you like to use for registration");
        responses.length = 0;
      }
    }
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "I want to sign up for Spartan services"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll help you sign up",
          actions: ["USER_REGISTRATION"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I want to register"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "What email u wanna use",
          actions: ["USER_REGISTRATION"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I'd like to sign up"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "based. what email u want me to use",
          actions: ["USER_REGISTRATION"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I'm thinking about signing up with openai"
        }
      },
      {
        name: "{{name2}}",
        content: {
          actions: ["IGNORE"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "email@email.com"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll help verify your email",
          actions: ["USER_REGISTRATION"]
        }
      }
    ]
  ]
};

// src/actions/act_reg_query.ts
import {
  createUniqueUuid as createUniqueUuid3
} from "@elizaos/core";
var checkRegistration = {
  name: "CHECK_REGISTRATION",
  similes: [],
  // can only enter this if we don't have an email
  validate: async (runtime, message) => {
    return true;
  },
  description: "Allows a user to see if they are registered",
  handler: async (runtime, message, state, _options, callback, responses) => {
    console.log("CHECK_REGISTRATION handler");
    const entityId = createUniqueUuid3(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    const email = entity.components.find((c) => c.type === EMAIL_TYPE);
    console.log("CHECK_REGISTRATION", email, email == null ? void 0 : email.data.verified);
    if (email) {
      if (email.data.verified) {
        takeItPrivate(runtime, message, "You are signed up under " + email.data.address);
      } else {
        takeItPrivate(runtime, message, "You are signed up under " + email.data.address + ", waiting to be verified");
      }
    } else {
      takeItPrivate(runtime, message, "You are not signed up");
    }
    responses.length = 0;
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "am I signed up?"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll check for you",
          actions: ["CHECK_REGISTRATION"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "am I registered?"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll check for you",
          actions: ["CHECK_REGISTRATION"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "am I signed up for openai?"
        }
      },
      {
        name: "{{name2}}",
        content: {
          actions: ["IGNORE"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "what is bob signed up under?"
        }
      },
      {
        name: "{{name2}}",
        content: {
          actions: ["IGNORE"]
        }
      }
    ]
  ]
};

// src/actions/act_reg_confirmemail.ts
import {
  createUniqueUuid as createUniqueUuid4
} from "@elizaos/core";
function findGeneratedCode(message, length) {
  const pattern = new RegExp(`\\b[A-Za-z0-9]{${length}}\\b`);
  const match = message.match(pattern);
  return match ? match[0] : null;
}
var checkRegistrationCode = {
  name: "VERIFY_REGISTRATION_CODE",
  similes: [],
  // can only enter this if we don't have an email
  validate: async (runtime, message) => {
    var _a;
    if (!message.metadata.authorId) return false;
    const entityId = createUniqueUuid4(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    const email = entity.components.find((c) => c.type === EMAIL_TYPE);
    const containsGeneratedCode = findGeneratedCode(message.content.text, 16);
    if (containsGeneratedCode !== null) {
      runtime.runtimeLogger.log("VERIFY_REGISTRATION_CODE containsGeneratedCode", typeof containsGeneratedCode, containsGeneratedCode);
    }
    return email && containsGeneratedCode !== null && !((_a = email.data) == null ? void 0 : _a.verified);
  },
  description: "Allows a user set their email address",
  handler: async (runtime, message, state, _options, callback, responses) => {
    console.log("VERIFY_REGISTRATION_CODE handler");
    const roomDetails = await runtime.getRoom(message.roomId);
    const entityId = createUniqueUuid4(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    console.log("VERIFY_REGISTRATION_CODE entity", entity);
    const email = entity.components.find((c) => c.type === EMAIL_TYPE);
    if (!email) {
      console.log("shouldnt be here");
      return;
    }
    const passedCode = findGeneratedCode(message.content.text, 16);
    if (passedCode === null) {
      console.log("shouldnt be here");
      return;
    }
    console.log("VERIFY_REGISTRATION_CODE email", email, "code", passedCode);
    if (email.data.tries === void 0) email.data.tries = 0;
    if (email.data.tries > 3) {
      console.log("hacker...");
      takeItPrivate(runtime, message, "You can no longer validate, you must delete your registration and restart");
      responses.length = 0;
      return;
    }
    if (passedCode === email.data.code) {
      email.data.verified = true;
      takeItPrivate(runtime, message, "Looks good, you are now registered and have access to my services");
    } else {
      email.data.tries++;
      takeItPrivate(runtime, message, "That does not match my records, please double check, it is case sensitive");
    }
    responses.length = 0;
    await runtime.updateComponent({
      id: email.id,
      worldId: roomDetails.worldId,
      roomId: message.roomId,
      sourceEntityId: message.entityId,
      entityId,
      type: EMAIL_TYPE,
      data: email.data,
      agentId: runtime.agentId
    });
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "This is my code you sent CODE"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll check it to see if it's correct",
          actions: ["VERIFY_REGISTRATION_CODE"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "This is the code openai sent CODE"
        }
      },
      {
        name: "{{name2}}",
        content: {
          actions: ["IGNORE"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "what was the code you emailed me?"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'm not going to tell you"
        }
      }
    ]
  ]
};

// src/actions/act_reg_delete.ts
import {
  createUniqueUuid as createUniqueUuid5
} from "@elizaos/core";
var deleteRegistration = {
  name: "DELETE_REGISTRATION",
  similes: [],
  // can only enter this if we don't have an email
  validate: async (runtime, message) => {
    if (!message.metadata.authorId) return false;
    const entityId = createUniqueUuid5(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    const email = entity.components.find((c) => c.type === EMAIL_TYPE);
    return email;
  },
  description: "Allows a user to delete their account with Spartan services",
  handler: async (runtime, message, state, _options, callback, responses) => {
    console.log("DELETE_REGISTRATION handler");
    const roomDetails = await runtime.getRoom(message.roomId);
    const entityId = createUniqueUuid5(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    console.log("entity", entity);
    const existingComponent = entity.components.find((c) => c.type === EMAIL_TYPE);
    if (existingComponent) {
      console.log("deleting", existingComponent);
      takeItPrivate(runtime, message, "Just cleared your registration: " + existingComponent.data.address);
      runtime.deleteComponent(existingComponent.id);
    } else {
      takeItPrivate(runtime, message, "Cant find your registration");
    }
    responses.length = 0;
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "Please delete my registration"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll help you delete your registration",
          actions: ["DELETE_REGISTRATION"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I can I delete my registration"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "Yes that's available",
          thought: "User is curious but we want confirmed before we act"
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "Please delete my email on openai"
        }
      },
      {
        name: "{{name2}}",
        content: {
          actions: ["IGNORE"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "Please delete my signup on user@email.com"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll help you delete your registration",
          actions: ["DELETE_REGISTRATION"]
        }
      }
    ]
  ]
};

// src/actions/act_menu.ts
import {
  createUniqueUuid as createUniqueUuid6
} from "@elizaos/core";
var menutext = "Heres what you can do";
var servicesMenu = {
  name: "SERVICES_MENU",
  similes: [],
  validate: async (runtime, message) => {
    return true;
  },
  description: "Explains/sells Spartan services",
  handler: async (runtime, message, state, _options, callback, responses) => {
    console.log("SERVICES_MENU handler");
    const entityId = createUniqueUuid6(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    const signedup = entity.components.find((c) => c.type === EMAIL_TYPE);
    await messageReply(runtime, message, "You can ask me to create a wallet for autonomous trading", responses);
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "What are Spartan services"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: menutext,
          actions: ["SERVICES_MENU"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "What can I do?"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: menutext,
          actions: ["SERVICES_MENU"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "menu"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: menutext,
          actions: ["SERVICES_MENU"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "What can I do with openai?"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "IDK, ask them"
        }
      }
    ]
  ]
};

// src/actions/act_wallet_create.ts
import {
  createUniqueUuid as createUniqueUuid7
} from "@elizaos/core";
var walletCreate = {
  name: "WALLET_CREATION",
  similes: [],
  validate: async (runtime, message) => {
    const traderChainService = runtime.getService("TRADER_STRATEGY");
    return traderChainService;
  },
  description: "Allows a user to create a wallet",
  handler: async (runtime, message, state, _options, callback, responses) => {
    console.log("WALLET_CREATION handler");
    const entityId = createUniqueUuid7(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    const email = entity.components.find((c) => c.type === EMAIL_TYPE);
    if (!email) {
      runtime.runtimeLogger.log("Not registered");
      messageReply(runtime, message, "You need to sign up for my services first", responses);
      responses.length = 0;
      return;
    }
    const traderChainService = runtime.getService("TRADER_STRATEGY");
    const stratgiesList = await traderChainService.listActiveStrategies();
    console.log("stratgiesList", stratgiesList);
    takeItPrivate(runtime, message, "Hrm youve already signed up, here are the available strategies: \n-" + stratgiesList.join("\n-") + "\n");
    responses.length = 0;
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "I want to create a wallet for autonomous trading"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll help you get started",
          actions: ["WALLET_CREATION"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I want to autotrade"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "What strategy u wanna use",
          actions: ["WALLET_CREATION"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I'd like to trade"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "based. what strategy u want me to use",
          actions: ["WALLET_CREATION"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I want to trade with a friend"
        }
      },
      {
        name: "{{name2}}",
        content: {
          actions: ["IGNORE"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "generate a wallet"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll help generate one, what trading strategy do you want to use?",
          actions: ["WALLET_CREATION"]
        }
      }
    ]
  ]
};

// src/actions/act_wallet_setstrategy.ts
import {
  createUniqueUuid as createUniqueUuid8
} from "@elizaos/core";
var setStrategy = {
  name: "WALLET_SETSTRAT",
  similes: [],
  validate: async (runtime, message) => {
    var _a, _b;
    console.log("WALLET_SETSTRAT validate", (_a = message == null ? void 0 : message.metadata) == null ? void 0 : _a.authorId);
    if (!((_b = message == null ? void 0 : message.metadata) == null ? void 0 : _b.authorId)) {
      console.log("WALLET_SETSTRAT validate - author not found");
      return false;
    }
    const entityId = createUniqueUuid8(runtime, message.metadata.authorId);
    if (entityId === null) return false;
    const entity = await runtime.getEntityById(entityId);
    const reg = !!entity.components.find((c) => c.type === EMAIL_TYPE);
    if (!reg) return false;
    const traderChainService = runtime.getService("TRADER_CHAIN");
    if (!traderChainService) return false;
    const traderStrategyService = runtime.getService("TRADER_STRATEGY");
    if (!traderStrategyService) return false;
    const stratgiesList = await traderStrategyService.listActiveStrategies();
    const containsStrat = stratgiesList.some((word) => message.content.text.includes(word));
    console.log("containsStrat", containsStrat, message.content.text);
    return containsStrat;
  },
  description: "Allows a user to create a wallet with a strategy",
  handler: async (runtime, message, state, _options, callback, responses) => {
    console.log("WALLET_SETSTRAT handler");
    const entityId = createUniqueUuid8(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    const email = entity.components.find((c) => c.type === EMAIL_TYPE);
    if (!email) {
      runtime.runtimeLogger.log("Not registered");
      return;
    }
    const roomDetails = await runtime.getRoom(message.roomId);
    const traderStrategyService = runtime.getService("TRADER_STRATEGY");
    const stratgiesList = await traderStrategyService.listActiveStrategies();
    const containsStrats = stratgiesList.filter((word) => message.content.text.includes(word));
    console.log("containsStrats", containsStrats);
    const traderChainService = runtime.getService("TRADER_CHAIN");
    const chains = await traderChainService.listActiveChains();
    console.log("chains", chains);
    const newData = email.data;
    if (newData.metawallets === void 0) newData.metawallets = [];
    const newWallet = {
      strategy: containsStrats[0]
    };
    const keypairs = {};
    for (const c of chains) {
      console.log("chain", c);
      const kp = await traderChainService.makeKeypair(c);
      console.log("kp", kp);
      keypairs[c] = kp;
    }
    newWallet.keypairs = keypairs;
    console.log("newWallet", newWallet);
    takeItPrivate(runtime, message, "Made a meta-wallet " + JSON.stringify(newWallet) + " please fund it to start trading");
    newData.metawallets.push(newWallet);
    newData.metawallets = [newWallet];
    await runtime.updateComponent({
      id: email.id,
      worldId: roomDetails.worldId,
      roomId: message.roomId,
      sourceEntityId: message.entityId,
      entityId,
      type: EMAIL_TYPE,
      data: newData,
      agentId: runtime.agentId
    });
    responses.length = 0;
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "I want to create a wallet for autonomous trading using X trading strategy"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll help you get started",
          actions: ["WALLET_SETSTRAT"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I want to autotrade with X trading strategy"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "Based",
          actions: ["WALLET_SETSTRAT"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I'd like to trade via X trading strategy"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "Based",
          actions: ["WALLET_SETSTRAT"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I want to trade with a friend"
        }
      },
      {
        name: "{{name2}}",
        content: {
          actions: ["IGNORE"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "generate a wallet using X trading strategy"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll help generate one",
          actions: ["WALLET_SETSTRAT"]
        }
      }
    ]
  ]
};

// src/actions/act_wallet_list.ts
import {
  createUniqueUuid as createUniqueUuid9
} from "@elizaos/core";
var userMetawalletList = {
  name: "USER_METAWALLET_LIST",
  similes: [],
  validate: async (runtime, message) => {
    var _a, _b;
    console.log("USER_METAWALLET_LIST validate", (_a = message == null ? void 0 : message.metadata) == null ? void 0 : _a.authorId);
    if (!((_b = message == null ? void 0 : message.metadata) == null ? void 0 : _b.authorId)) {
      console.log("USER_METAWALLET_LIST validate - author not found");
      return false;
    }
    const entityId = createUniqueUuid9(runtime, message.metadata.authorId);
    if (entityId === null) return false;
    const entity = await runtime.getEntityById(entityId);
    const reg = !!entity.components.find((c) => c.type === EMAIL_TYPE);
    if (!reg) return false;
    const traderChainService = runtime.getService("TRADER_CHAIN");
    if (!traderChainService) return false;
    const traderStrategyService = runtime.getService("TRADER_STRATEGY");
    if (!traderStrategyService) return false;
    return true;
  },
  description: "Allows a user to list all wallets they have",
  handler: async (runtime, message, state, _options, callback, responses) => {
    console.log("USER_METAWALLET_LIST handler");
    const entityId = createUniqueUuid9(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId);
    const email = entity.components.find((c) => c.type === EMAIL_TYPE);
    if (!email) {
      runtime.runtimeLogger.log("Not registered");
      return;
    }
    const roomDetails = await runtime.getRoom(message.roomId);
    const traderStrategyService = runtime.getService("TRADER_STRATEGY");
    const stratgiesList = await traderStrategyService.listActiveStrategies();
    const containsStrats = stratgiesList.filter((word) => message.content.text.includes(word));
    console.log("containsStrats", containsStrats);
    const traderChainService = runtime.getService("TRADER_CHAIN");
    const chains = await traderChainService.listActiveChains();
    console.log("chains", chains);
    takeItPrivate(runtime, message, "List wallets: " + JSON.stringify(email.data.metawallets));
    responses.length = 0;
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "What wallets do I have"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "Here",
          actions: ["USER_METAWALLET_LIST"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "list wallets"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "Here",
          actions: ["USER_METAWALLET_LIST"]
        }
      }
    ],
    [
      {
        name: "{{name1}}",
        content: {
          text: "I want list all my wallets for you"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "What?"
        }
      }
    ]
  ]
};

// src/actions/devfix.ts
import {
  createUniqueUuid as createUniqueUuid10
} from "@elizaos/core";
var devFix = {
  name: "DEV_FIX",
  similes: [],
  validate: async (runtime, message) => {
    return true;
  },
  description: "Allows developer to fix their shit",
  handler: async (runtime, message, state, _options, callback, responses) => {
    console.log("DEV_FIX handler");
    const roomDetails = await runtime.getRoom(message.roomId);
    const roomEntity = await runtime.getEntityById(message.roomId);
    const agentEntityId = createUniqueUuid10(runtime, runtime.agentId);
    const agentEntity = await runtime.getEntityById(agentEntityId);
    let spartanData = agentEntity.components.find((c) => c.type === SPARTAN_SERVICE_TYPE);
    console.log("spartanData", spartanData);
    let spartanDataNew = false;
    let spartanDataDelta = false;
    if (!spartanData) {
      spartanDataNew = true;
      spartanDataDelta = true;
      spartanData = {
        users: []
      };
    }
    const entityId = createUniqueUuid10(runtime, message.metadata.authorId);
    console.log("would have responded", responses);
    return;
    async function updateSpartanData(agentEntityId2, spartanData2) {
      if (spartanDataNew) {
        await runtime.createComponent({
          id: v4_default(),
          agentId: runtime.agentId,
          worldId: roomDetails.worldId,
          roomId: message.roomId,
          sourceEntityId: entityId,
          entityId: agentEntityId2,
          type: SPARTAN_SERVICE_TYPE,
          data: spartanData2
        });
      } else {
        await runtime.updateComponent({
          id: spartanData2.id,
          // do we need all these fields?
          //agentId: runtime.agentId,
          //worldId: roomDetails.worldId,
          //roomId: message.roomId,
          //sourceEntityId: entityId,
          //entityId: entityId,
          //type: SPARTAN_SERVICE_TYPE,
          data: agentEntity.components
        });
      }
    }
    if (spartanDataDelta) {
      updateSpartanData(agentEntityId, spartanData);
    }
    takeItPrivate(runtime, message, "What you want me to fix boss");
    responses.length = 0;
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "please run dev fix"
        }
      },
      {
        name: "{{name2}}",
        content: {
          text: "I'll fix your data",
          actions: ["DEV_FIX"]
        }
      }
    ]
  ]
};

// src/index.ts
var appPlugin = {
  name: "AppDev",
  description: "application development framework for ElizaOS",
  actions: [
    userRegistration,
    checkRegistrationCode,
    checkRegistration,
    deleteRegistration,
    servicesMenu,
    walletCreate,
    setStrategy,
    userMetawalletList,
    devFix
  ],
  evaluators: [],
  providers: []
};
var index_default = appPlugin;
export {
  appPlugin,
  index_default as default
};
//# sourceMappingURL=index.js.map