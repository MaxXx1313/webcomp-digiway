// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later


/**
 * iso-8601 string
 */
export type DateTimeString = string;

/**
 *
 */
export interface FlatDataResponse<T> {
  offset: number;
  limit: number;
  data: T[];
}


export interface Measurement {
  mvalue: string | number | any;
  mvalidtime: DateTimeString;
  mtransactiontime: DateTimeString;
  /**
   * Distance in seconds between two measurements
   */
  mperiod: number;
// mprovenance:	Provenance
}

// export interface Provenance {
//
// }
export interface Datatype {
  tname: string;
  tunit: string;
  ttype: string;
  tdescription: string;
  tmeasurements: Measurement[];
}


export interface Station {
  sname: string;
  stype: string;
  scode: string;
  sorigin: string;
  sactive: string;
  scoordinate: Coordinate;
  smetadata: any;
// sparent:Parent;
}

interface Coordinate {
  x: number
  y: number
  srid: number;
}
