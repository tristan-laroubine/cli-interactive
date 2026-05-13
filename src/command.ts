import z, { ZodRawShape } from "zod";
import {
	ZodRawShape as ZodRawShapeV3,
	ZodObject as ZodObjectV3,
	ZodOptional as ZodOptionalV3,
	ZodDefault as ZodDefaultV3,
	ZodString as ZodStringV3,
	ZodNumber as ZodNumberV3,
	ZodDate as ZodDateV3,
	ZodBoolean as ZodBooleanV3,
	ZodEnum as ZodEnumV3,
} from "zod/v3";
import { Command } from "commander";
import { input, select, confirm, number } from "@inquirer/prompts";

interface SystemOptions {
	noPrompt?: boolean;
}

type ZodRawShapeCombination = ZodRawShape | ZodRawShapeV3;
type ZodObjectCombination = z.ZodObject<ZodRawShape> | ZodObjectV3<ZodRawShapeV3>;

export async function resolveArgs<T extends ZodObjectCombination>(schema: T): Promise<z.infer<T>> {
	try {
		const shape: ZodRawShapeCombination = schema.shape;
		const cliArgs = extractParametersFromArgv(schema);
		const missingParameters = Object.keys(shape).filter(
			(key) => (cliArgs as Record<string, unknown>)?.[key] === undefined,
		);
		const promptedValues: Partial<z.infer<T>> = {};
		if (!cliArgs.noPrompt) {
			for (const key of missingParameters) {
				const parameter = schema.shape[key];
				try {
					const value = await promptUser({
						name: key,
						originalParameter: parameter as z.ZodTypeAny,
					});
					(promptedValues as Record<string, unknown>)[key] = value;
				} catch (error) {
					if (error instanceof z.ZodError) {
						explainZodError(error, key);
					} else {
						console.error(`Error parsing input for ${key}:`, error);
					}
					process.exit(1);
				}
			}
		}
		const combinedArgs = { ...cliArgs, ...promptedValues } as z.infer<T>;
		return schema.parse(combinedArgs) as z.output<T>;
	} catch (error) {
		if (error instanceof z.ZodError) {
			explainZodError(error);
			process.exit(1);
		}
		throw error;
	}
}

function extractParametersFromArgv<T extends ZodObjectCombination>(schema: T): Partial<z.infer<T> & SystemOptions> {
	const command = new Command();
	for (const key in schema.shape) {
		const parameter = schema.shape[key] as z.ZodTypeAny;
		const { rowType: rawParameter, defaultValue } = extractRawZodType(parameter);
		const flag = `--${key}`;
		if (rawParameter instanceof z.ZodBoolean || rawParameter instanceof ZodBooleanV3) {
			command.option(`${flag}`, rawParameter.description, defaultValue as boolean | undefined);
		} else if (rawParameter instanceof z.ZodEnum || rawParameter instanceof ZodEnumV3) {
			const options = (rawParameter.options as string[]).join(", ");
			command.option(`${flag} <value>`, `${rawParameter.description} (options: ${options})`);
		} else {
			command.option(`${flag} <value>`, rawParameter.description);
		}
	}
	command.option("--no-prompt", "Disable interactive prompts and use defaults or fail if required parameters are missing");
	return command.parse(process.argv).opts();
}

async function promptUser<T extends z.ZodTypeAny>({
	name,
	originalParameter,
}: {
	name: string;
	originalParameter: T;
}): Promise<z.infer<T>> {
	const { rowType: innerParameter, isOptional, defaultValue } = extractRawZodType(originalParameter);
	const message = originalParameter.description ?? innerParameter.description ?? `Enter a value for ${name}`;

	if (innerParameter instanceof z.ZodString || innerParameter instanceof ZodStringV3) {
		const value = await input({
			message,
			default: defaultValue as string | undefined,
			required: !isOptional && defaultValue === undefined,
		});
		return originalParameter.parse(value || undefined) as z.infer<T>;
	} else if (innerParameter instanceof z.ZodNumber || innerParameter instanceof ZodNumberV3) {
		const value = await number({
			message,
			default: defaultValue as number | undefined,
			required: !isOptional && defaultValue === undefined,
		});
		return originalParameter.parse(value) as z.infer<T>;
	} else if (innerParameter instanceof z.ZodDate || innerParameter instanceof ZodDateV3) {
		const raw = await input({
			message,
			default: defaultValue instanceof Date ? defaultValue.toISOString() : (defaultValue as string | undefined),
			required: !isOptional && defaultValue === undefined,
		});
		return originalParameter.parse(raw ? new Date(raw) : undefined) as z.infer<T>;
	} else if (innerParameter instanceof z.ZodBoolean || innerParameter instanceof ZodBooleanV3) {
		const value = await confirm({
			message,
			default: defaultValue as boolean | undefined,
		});
		return originalParameter.parse(value) as z.infer<T>;
	} else if (innerParameter instanceof z.ZodEnum || innerParameter instanceof ZodEnumV3) {
		const choices = (innerParameter.options as string[]).map((opt) => ({ value: opt }));
		const value = await select({
			message,
			choices,
			default: defaultValue as string | undefined,
		});
		return originalParameter.parse(value) as z.infer<T>;
	} else {
		throw new Error(`Unsupported parameter type: ${innerParameter?.constructor.name}`);
	}
}

function extractRawZodType(parameter: z.ZodTypeAny): {
	rowType: z.ZodTypeAny;
	isOptional: boolean;
	defaultValue?: unknown;
} {
	function recurse(param: z.ZodTypeAny, opts: { isOptional: boolean; defaultValue?: unknown }) {
		if (param instanceof z.ZodOptional || param instanceof ZodOptionalV3) {
			return recurse((param as any)._def.innerType as z.ZodTypeAny, { ...opts, isOptional: true });
		}
		if (param instanceof z.ZodDefault || param instanceof ZodDefaultV3) {
			const dv = (param as any)._def.defaultValue;
			return recurse((param as any)._def.innerType as z.ZodTypeAny, {
				...opts,
				defaultValue: typeof dv === "function" ? dv() : dv,
			});
		}
		return { rowType: param, isOptional: opts.isOptional ?? false, defaultValue: opts.defaultValue };
	}
	return recurse(parameter, { isOptional: false });
}

function explainZodError(error: z.ZodError, key?: string) {
	for (const issue of error.issues) {
		const path = key ? `Parameter "${key}"` : issue.path.join(" -> ");
		console.error(`${path}: ${issue.message}`);
	}
}
