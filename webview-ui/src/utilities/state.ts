import { useEffect, useReducer } from "react";
import { Command, CommandKeys, MessageDefinition, MessageHandler } from "../../../src/webview-contract/messaging";
import {
    ContentId,
    InitialState,
    ToWebviewMsgDef,
    WebviewMessageContext,
} from "../../../src/webview-contract/webviewTypes";

export interface WebviewStateUpdater<T extends ContentId, TEventDef extends MessageDefinition, TState> {
    createState: (initialState: InitialState<T>) => TState;
    vscodeMessageHandler: StateMessageHandler<ToWebviewMsgDef<T>, TState>;
    eventHandler: StateMessageHandler<TEventDef, TState>;
}

export type StateManagement<TEventDef extends MessageDefinition, TState> = {
    state: TState;
    eventHandlers: EventHandlers<TEventDef>;
};

/**
 * Custom hook (https://react.dev/learn/reusing-logic-with-custom-hooks) ensuring that the component subscribes to messages
 * from VS Code, and updates its state in response to both messages from VS Code and webview events.
 * @param stateUpdater
 * @param initialState
 * @param vscode
 * @returns
 */
export function useStateManagement<T extends ContentId, TEventDef extends MessageDefinition, TState>(
    stateUpdater: WebviewStateUpdater<T, TEventDef, TState>,
    initialState: InitialState<T>,
    vscode: WebviewMessageContext<T>,
): StateManagement<TEventDef, TState> {
    const updateState = chainStateUpdaters(
        toStateUpdater(stateUpdater.vscodeMessageHandler),
        toStateUpdater(stateUpdater.eventHandler),
    );

    const [state, dispatch] = useReducer(updateState, stateUpdater.createState(initialState));
    const eventHandlers = getEventHandlers<TEventDef>(dispatch, stateUpdater.eventHandler);

    useEffect(() => {
        const vsCodeMessageHandlers = getMessageHandler<ToWebviewMsgDef<T>>(
            dispatch,
            stateUpdater.vscodeMessageHandler,
        );
        vscode.subscribeToMessages(vsCodeMessageHandlers);
    }, [vscode, stateUpdater.vscodeMessageHandler]);

    return { state, eventHandlers };
}

/**
 * The type used to define handlers for messages that change the state of a component
 * when using a reducer (https://react.dev/reference/react/useReducer).
 */
export type StateMessageHandler<TMsgDef extends MessageDefinition, TState> = {
    [P in Command<TMsgDef>]: (state: TState, msg: TMsgDef[P]) => TState;
};

/**
 * The type of the 'action' in the reducer.
 */
type StateMessage = {
    command: string;
    args?: unknown;
};

/**
 * A reducer type that uses the `StateMessage` action. This is a function that applies an action
 * to a state to return another state.
 */
type StateUpdater<TState> = React.Reducer<TState, StateMessage>;

/**
 * Takes a message handler for updating state and creates a reducer that can be used in the
 * `useReducer` function.
 */
function toStateUpdater<TMsgDef extends MessageDefinition, TState>(
    handler: StateMessageHandler<TMsgDef, TState>,
): StateUpdater<TState> {
    return (state, msg) => {
        if (msg.command in handler) {
            return handler[msg.command](state, msg.args as TMsgDef[string]); // TODO: Check this cast
        }

        return state;
    };
}

/**
 * Allows multiple reducers to be combined into a single one (used when processing different types of message).
 */
function chainStateUpdaters<TState>(...stateUpdaters: StateUpdater<TState>[]): StateUpdater<TState> {
    return stateUpdaters.reduce(
        (prev, curr) => {
            return (state, msg) => curr(prev(state, msg), msg);
        },
        (state) => state,
    );
}

/**
 * An event handler type for a particular kind of message. Each command in the message definition is prefixed
 * with `on`.
 */
export type EventHandlers<TMsgDef extends MessageDefinition> = {
    [P in Command<TMsgDef> as `on${Capitalize<P>}`]: (args: TMsgDef[P]) => void;
};

/**
 * Creates event handlers for a message definition which forward calls to the `dispatch` function
 * (https://react.dev/reference/react/useReducer#dispatch)
 */
function getEventHandlers<TMsgDef extends MessageDefinition>(
    dispatch: React.Dispatch<StateMessage>,
    keys: CommandKeys<TMsgDef>,
): EventHandlers<TMsgDef> {
    const entries = Object.keys(keys).map((command) => [
        asEvent(command),
        (args: unknown) => dispatch({ command: command, args }),
    ]);
    return Object.fromEntries(entries);
}

function asEvent(str: string) {
    return `on${str[0].toUpperCase()}${str.slice(1)}`;
}

/**
 * Creates a handler for a message definition which can be used by a message subscriber, and which
 * forwards invocations to the `dispatch` function.
 */
function getMessageHandler<TMsgDef extends MessageDefinition>(
    dispatch: React.Dispatch<StateMessage>,
    keys: CommandKeys<TMsgDef>,
): MessageHandler<TMsgDef> {
    const entries = Object.keys(keys).map((command) => [
        command,
        (args: unknown) => dispatch({ command: command, args }),
    ]);
    return Object.fromEntries(entries);
}
