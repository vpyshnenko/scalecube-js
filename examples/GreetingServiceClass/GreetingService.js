// @flow
import { Observable } from 'rxjs/Observable';

interface api {
  static meta: any;
}
class GreetingService implements api {
  static meta: any;
  constructor(){
    console.log('Constructor called >>>>>>>>>>', new Error());
  }
  hello(name: string) {
    return new Promise((resolve, reject)=>{
      if( name === undefined ) {
        reject(new Error('please provide user to greet'));
      } else {
        resolve(`Hello ${name}`);
      }
    });
  }
  repeatToStream(...greetings: string[]) {
    return Observable.create((observer) => {
      if( greetings === undefined || !Array.isArray(greetings) || greetings.length === 0 ) {
        return observer.error(new Error('please provide Array of greetings'))
      }
      greetings.map((i)=>observer.next(i));
    });
  }
}
Object.defineProperty(GreetingService, 'meta', {
  value: {
    type: 'class',
    methods: {
      hello: {
        type: 'Promise'
      },
      repeatToStream: {
        type: 'Observable'
      }
    }
  }
});


export default GreetingService;