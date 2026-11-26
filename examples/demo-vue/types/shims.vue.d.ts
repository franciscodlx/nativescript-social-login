declare module '*.vue' {
  import { DefineComponent } from 'nativescript-vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
