/**
 * `@istanbuljs/schema` ships no type definitions. Only the surface used by
 * this package is declared here, shaped after the actual runtime values.
 */
declare module "@istanbuljs/schema" {
  export const defaults: {
    instrumenter: {
      coverageVariable: string;
      coverageGlobalScope: string;
      coverageGlobalScopeFunc: boolean;
      ignoreClassMethods: string[];
      autoWrap: boolean;
      esModules: boolean;
      parserPlugins: string[];
      compact: boolean;
      preserveComments: boolean;
      produceSourceMap: boolean;
    };
    instrumentVisitor: {
      coverageVariable: string;
      coverageGlobalScope: string;
      coverageGlobalScopeFunc: boolean;
      ignoreClassMethods: string[];
    };
  };
}
