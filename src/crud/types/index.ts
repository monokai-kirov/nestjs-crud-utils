export type CrudOptions = {
	withDtoValidation?: boolean;
	withRelationValidation?: boolean;
	withUploadValidation?: boolean;
	withTriggersCreation?: boolean;
	withActiveUpdate?: false | ActiveUpdate;
	unscoped?: boolean;
	additionalScopes?: string[];
	childModels?: any[];
};

export type EntityOptions = {
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
};

export type Include = { all: boolean } | Record<string, any>[];

export type SearchingProps = Array<
	string | string[] | { property: string | string[]; transform: (value: any) => any }
>;

export interface ActiveUpdate {
	calcActive?: (dto) => boolean;
	childs: Array<Record<string, any> | ActiveUpdateOption>;
}
export interface ActiveUpdateOption {
	model: any;
	field: string;
	trueValue: boolean | string;
	falsyValue: boolean | string;
}

export type Files = { [key: string]: any } | any[];

export type CrudResponse = {
	statusCode: number;
	[key: string]: any;
};

export type ValidateResult = { dto: any; files: any; [key: string]: any };

export interface ValidateAndParseJsonInput {
	input;
	errorMessage: string;
	keyConstraint?: (key: string) => boolean;
	valueConstraint?: (value: any) => boolean;
	keyTransform?: (key: any) => any;
	valueTransform?: (value: any) => any;
}
