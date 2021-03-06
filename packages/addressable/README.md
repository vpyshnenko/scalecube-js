# Addressable

A lightweight standalone micro lib to create addressable post messages.  
Let say you have some post messages on the main thread a couple of IFrames and a few web workers.  
Sending message between this element will be a nightmare!

The solution, **addresses** like a plan tcp/ip network, or the WEB

-   This package is independent it maintained under scalecube-js only for convenience.

## TODO

Handle address collusion

# API

Add thread to network; you must add it to main thread in order iframe/workers will work

```ts
import '@scalecube/addressable';
```

listen for messages on address

```ts
import {listen} from '@scalecube/addressable';
listen("address", (msg, port: MessagePort)=>{port.postMessage("pong")});
```

connect to address

```ts
import {connect} from '@scalecube/addressable';
const port = connect("address");
port.addEventListener("message", console.log);
port.postMessage("ping");
```

Cleaning connections

```ts
import {connect, listen} from '@scalecube/addressable';
listen("address", (msg, port: MessagePort) => {
    if( msg === "ping" ) {
        port.postMessage("pong");
    } else if (msg === "close") {
        port.close();
    }
});

const port = connect("address");
port.addEventListener("message", console.log);
port.postMessage("ping");
port.postMessage("close");
port.close();
```

# How it's works

-   Each time you import addressable it will create global event listener in each thread
-   Threads will register them self by sending a message to main thread
-   Each time new listener added it will spread to main thread and to all thread from there
-   When connect is called it will create a message channel and give a port to listen callback and open side 
