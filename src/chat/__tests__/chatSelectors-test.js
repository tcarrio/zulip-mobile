import deepFreeze from 'deep-freeze';

import {
  getFirstMessageId,
  getLastMessageId,
  getLastTopicForNarrow,
  getMessagesForNarrow,
  getStreamInNarrow,
  isNarrowValid,
} from '../chatSelectors';
import {
  HOME_NARROW,
  HOME_NARROW_STR,
  privateNarrow,
  streamNarrow,
  topicNarrow,
  STARRED_NARROW,
  groupNarrow,
} from '../../utils/narrow';
import { NULL_SUBSCRIPTION } from '../../nullObjects';

describe('getMessagesForNarrow', () => {
  test('if no outbox messages returns messages with no change', () => {
    const state = deepFreeze({
      messages: {
        '[]': [{ id: 123 }],
      },
      outbox: [],
    });

    const anchor = getMessagesForNarrow(HOME_NARROW)(state);

    expect(anchor).toBe(state.messages['[]']);
  });

  test('combine messages and outbox in same narrow', () => {
    const state = deepFreeze({
      messages: {
        '[]': [{ id: 123 }],
      },
      outbox: [
        {
          email: 'donald@zulip.com',
          narrow: HOME_NARROW,
          parsedContent: '<p>Hello</p>',
          sender_full_name: 'donald',
          timestamp: 12,
        },
      ],
      caughtUp: {
        [HOME_NARROW_STR]: { older: false, newer: true },
      },
    });

    const anchor = getMessagesForNarrow(HOME_NARROW)(state);

    const expectedState = deepFreeze([
      { id: 123 },
      {
        email: 'donald@zulip.com',
        narrow: [],
        parsedContent: '<p>Hello</p>',
        sender_full_name: 'donald',
        timestamp: 12,
      },
    ]);

    expect(anchor).toEqual(expectedState);
  });

  test('do not combine messages and outbox if not caught up', () => {
    const state = deepFreeze({
      messages: {
        [HOME_NARROW_STR]: [{ id: 123 }],
      },
      outbox: [
        {
          email: 'donald@zulip.com',
          narrow: HOME_NARROW,
          parsedContent: '<p>Hello</p>',
          sender_full_name: 'donald',
          timestamp: 12,
        },
      ],
    });

    const anchor = getMessagesForNarrow(HOME_NARROW)(state);

    expect(anchor).toBe(state.messages[HOME_NARROW_STR]);
  });

  test('do not combine messages and outbox in different narrow', () => {
    const state = deepFreeze({
      messages: {
        [JSON.stringify(privateNarrow('john@example.com'))]: [{ id: 123 }],
      },
      outbox: [
        {
          email: 'donald@zulip.com',
          narrow: streamNarrow('denmark', 'denmark'),
          parsedContent: '<p>Hello</p>',
          sender_full_name: 'donald',
          timestamp: 12,
        },
      ],
    });

    const anchor = getMessagesForNarrow(privateNarrow('john@example.com'))(state);

    const expectedState = deepFreeze([{ id: 123 }]);

    expect(anchor).toEqual(expectedState);
  });
});

describe('getFirstMessageId', () => {
  test('return undefined when there are no messages', () => {
    const state = deepFreeze({
      messages: {
        '[]': [],
      },
      outbox: [],
    });

    const anchor = getFirstMessageId(HOME_NARROW)(state);

    expect(anchor).toEqual(undefined);
  });

  test('returns first message id', () => {
    const state = deepFreeze({
      messages: {
        '[]': [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
      outbox: [],
    });

    const anchor = getFirstMessageId(HOME_NARROW)(state);

    expect(anchor).toEqual(1);
  });
});

describe('getLastMessageId', () => {
  test('return undefined when there are no messages', () => {
    const state = deepFreeze({
      messages: {
        '[]': [],
      },
      outbox: [],
    });

    const anchor = getLastMessageId(HOME_NARROW)(state);

    expect(anchor).toEqual(undefined);
  });

  test('returns last message id', () => {
    const state = deepFreeze({
      messages: {
        '[]': [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
      outbox: [],
    });

    const anchor = getLastMessageId(HOME_NARROW)(state);

    expect(anchor).toEqual(3);
  });
});

describe('getLastTopicForNarrow', () => {
  test('when no messages yet, return empty string', () => {
    const state = deepFreeze({
      messages: {},
      outbox: [],
    });

    const actualLastTopic = getLastTopicForNarrow(HOME_NARROW)(state);

    expect(actualLastTopic).toEqual('');
  });

  test('when last message has a `subject` property, return it', () => {
    const state = deepFreeze({
      messages: {
        [HOME_NARROW_STR]: [
          { id: 0, subject: 'First subject' },
          { id: 1, subject: 'Last subject' },
        ],
      },
      outbox: [],
    });

    const actualLastTopic = getLastTopicForNarrow(HOME_NARROW)(state);

    expect(actualLastTopic).toEqual('Last subject');
  });

  test('when there are messages, but none with a `subject` property, return empty', () => {
    const narrow = privateNarrow('john@example.com');
    const state = deepFreeze({
      messages: {
        [JSON.stringify(narrow)]: [{ id: 0 }],
      },
      outbox: [],
    });

    const actualLastTopic = getLastTopicForNarrow(narrow)(state);

    expect(actualLastTopic).toEqual('');
  });

  test('when last message has no `subject` property, return last one that has', () => {
    const narrow = privateNarrow('john@example.com');
    const state = deepFreeze({
      messages: {
        [JSON.stringify(narrow)]: [{ id: 0 }, { id: 1, subject: 'Some subject' }, { id: 2 }],
      },
      outbox: [],
    });

    const actualLastTopic = getLastTopicForNarrow(narrow)(state);

    expect(actualLastTopic).toEqual('Some subject');
  });
});

describe('getStreamInNarrow', () => {
  const state = deepFreeze({
    streams: [{ name: 'stream' }, { name: 'steam2' }, { name: 'stream3' }],
    subscriptions: [
      { name: 'stream', in_home_view: false },
      { name: 'stream2', in_home_view: true },
    ],
  });

  test('return subscription if stream in narrow is subscribed', () => {
    const narrow = streamNarrow('stream');

    expect(getStreamInNarrow(narrow)(state)).toEqual({ name: 'stream', in_home_view: false });
  });

  test('return stream if stream in narrow is not subscribed', () => {
    const narrow = streamNarrow('stream3');

    expect(getStreamInNarrow(narrow)(state)).toEqual({ name: 'stream3', in_home_view: true });
  });

  test('return NULL_SUBSCRIPTION if stream in narrow is not valid', () => {
    const narrow = streamNarrow('stream4');

    expect(getStreamInNarrow(narrow)(state)).toEqual(NULL_SUBSCRIPTION);
  });

  test('return NULL_SUBSCRIPTION is narrow is not topic or stream', () => {
    expect(getStreamInNarrow(undefined)(state)).toEqual(NULL_SUBSCRIPTION);
    expect(getStreamInNarrow(privateNarrow('abc@zulip.com'))(state)).toEqual(NULL_SUBSCRIPTION);
    expect(getStreamInNarrow(topicNarrow('stream4', 'topic'))(state)).toEqual(NULL_SUBSCRIPTION);
  });
});

describe('isNarrowValid', () => {
  test('narrowing to a special narrow is always valid', () => {
    const state = {
      realm: {},
    };
    const narrow = STARRED_NARROW;

    const result = isNarrowValid(narrow)(state);

    expect(result).toBe(true);
  });

  test('narrowing to an existing stream is valid', () => {
    const state = {
      realm: {},
      streams: [{ name: 'some stream' }],
    };
    const narrow = streamNarrow('some stream');

    const result = isNarrowValid(narrow)(state);

    expect(result).toBe(true);
  });

  test('narrowing to a non-existing stream is invalid', () => {
    const state = {
      realm: {},
      streams: [],
    };
    const narrow = streamNarrow('nonexisting');

    const result = isNarrowValid(narrow)(state);

    expect(result).toBe(false);
  });

  test('narrowing to an existing stream is valid regardless of topic', () => {
    const state = {
      realm: {},
      streams: [{ name: 'some stream' }],
    };
    const narrow = topicNarrow('some stream', 'topic does not matter');

    const result = isNarrowValid(narrow)(state);

    expect(result).toBe(true);
  });

  test('narrowing to a PM with existing user is valid', () => {
    const state = {
      realm: {
        crossRealmBots: [],
        nonActiveUsers: [],
      },
      streams: [],
      users: [{ email: 'bob@example.com' }],
    };
    const narrow = privateNarrow('bob@example.com');

    const result = isNarrowValid(narrow)(state);

    expect(result).toBe(true);
  });

  test('narrowing to a PM with non-existing user is not valid', () => {
    const state = {
      realm: {
        crossRealmBots: [],
        nonActiveUsers: [],
      },
      streams: [],
      users: [],
    };
    const narrow = privateNarrow('bob@example.com');

    const result = isNarrowValid(narrow)(state);

    expect(result).toBe(false);
  });

  test('narrowing to a group chat with non-existing user is not valid', () => {
    const state = {
      realm: {
        crossRealmBots: [],
        nonActiveUsers: [],
      },
      streams: [],
      users: [{ email: 'john@example.com' }, { email: 'mark@example.com' }],
    };
    const narrow = groupNarrow(['john@example.com', 'mark@example.com']);

    const result = isNarrowValid(narrow)(state);

    expect(result).toBe(true);
  });

  test('narrowing to a group chat with non-existing users is also valid', () => {
    const state = {
      realm: {
        crossRealmBots: [],
        nonActiveUsers: [],
      },
      streams: [],
      users: [],
    };
    const narrow = groupNarrow(['john@example.com', 'mark@example.com']);

    const result = isNarrowValid(narrow)(state);

    expect(result).toBe(true);
  });

  test('narrowing to a PM with bots is valid', () => {
    const state = {
      realm: {
        crossRealmBots: [{ email: 'some-bot@example.com' }],
        nonActiveUsers: [],
      },
      streams: [],
      users: [],
    };
    const narrow = privateNarrow('some-bot@example.com');

    const result = isNarrowValid(narrow)(state);

    expect(result).toBe(true);
  });

  test('narrowing to non active users is valid', () => {
    const state = {
      realm: {
        crossRealmBots: [],
        nonActiveUsers: [{ email: 'not-active@example.com' }],
      },
      streams: [],
      users: [],
    };
    const narrow = privateNarrow('not-active@example.com');

    const result = isNarrowValid(narrow)(state);

    expect(result).toBe(true);
  });
});
