import {
  ModuleKind,
  ModuleResolutionKind,
  Node,
  Project,
  ScriptTarget,
  SyntaxKind,
  ts,
} from 'ts-morph';

import { ExpressRouteParserError } from './errors.js';
import type {
  ExpressHttpMethod,
  ExpressRoute,
  ExtractExpressRoutesOptions,
} from './types.js';

const supportedReceivers = new Set(['app', 'router']);
const supportedMethods = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
} as const satisfies Record<string, ExpressHttpMethod>;

type SupportedMethod = keyof typeof supportedMethods;

export function extractExpressRoutes(
  sourceCode: string,
  options: ExtractExpressRoutesOptions = {},
): ExpressRoute[] {
  const filePath = options.filePath ?? 'source.ts';

  if (typeof sourceCode !== 'string') {
    throw new ExpressRouteParserError('Source code must be a string', filePath);
  }

  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw new ExpressRouteParserError(
      'The source file path must be a non-empty string',
      'unknown',
    );
  }

  try {
    const project = new Project({
      useInMemoryFileSystem: true,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        allowJs: true,
        checkJs: false,
        module: ModuleKind.NodeNext,
        moduleResolution: ModuleResolutionKind.NodeNext,
        noResolve: true,
        target: ScriptTarget.ES2022,
      },
    });
    const sourceFile = project.createSourceFile(filePath, sourceCode, {
      overwrite: true,
    });
    const diagnostics = project
      .getProgram()
      .compilerObject.getSyntacticDiagnostics(sourceFile.compilerNode);

    if (diagnostics.length > 0) {
      const details = diagnostics
        .map((diagnostic) => formatDiagnostic(diagnostic))
        .join('; ');
      throw new ExpressRouteParserError(
        'Unable to parse source code: ' + details,
        filePath,
      );
    }

    const routes: ExpressRoute[] = [];

    for (const callExpression of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression,
    )) {
      const expression = callExpression.getExpression();

      if (!Node.isPropertyAccessExpression(expression)) {
        continue;
      }

      const receiver = expression.getExpression();
      const method = expression.getName();

      if (
        !Node.isIdentifier(receiver) ||
        !supportedReceivers.has(receiver.getText()) ||
        !isSupportedMethod(method)
      ) {
        continue;
      }

      const args = callExpression.getArguments();

      if (args.length < 2) {
        continue;
      }

      const pathArgument = args[0];
      const handlerArgument = args.at(-1);

      if (
        pathArgument === undefined ||
        handlerArgument === undefined ||
        !Node.isStringLiteral(pathArgument)
      ) {
        continue;
      }

      routes.push({
        method: supportedMethods[method],
        path: pathArgument.getLiteralValue(),
        middleware: args.slice(1, -1).map((argument) => argument.getText()),
        handler: handlerArgument.getText(),
      });
    }

    return routes;
  } catch (error) {
    if (error instanceof ExpressRouteParserError) {
      throw error;
    }

    throw new ExpressRouteParserError(
      'Unexpected failure while parsing source code',
      filePath,
      { cause: error },
    );
  }
}

function isSupportedMethod(method: string): method is SupportedMethod {
  return method in supportedMethods;
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

  if (diagnostic.file === undefined || diagnostic.start === undefined) {
    return message;
  }

  const position = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start,
  );
  return (
    String(position.line + 1) +
    ':' +
    String(position.character + 1) +
    ' ' +
    message
  );
}
