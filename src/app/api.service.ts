import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';
import { map, takeUntil, tap } from 'rxjs/operators';

const DB_NAME = 'AsoStressTestDatabase';
const TEST_OBJSTORE = 'tests';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  kill$: Subject<void> = new Subject();
  complete$: Subject<void> = new Subject();

  constructor(private http: HttpClient) {
    this.setupDBConnection();
    this.complete$.subscribe(() => this.storeMeta());
  }

  /**
   * Test meta configuration
   */
  apiUrl: string;
  interval: number;
  apiNumber: number;
  max: number;
  startTime: Date;

  /**
   * Test result realted
   */
  counter: number = 0;
  success: number = 0;
  failure: number = 0;
  meta: MetaData[] = [];
  errors: any[] = [];
  timerStopped: boolean;

  /**
   * IndexedDb
   */
  private db: IDBDatabase;

  startTesting(apiUrl: string, interval: number, apiNumber: number, max: number): void {
    // Reset
    this.counter = 0;
    this.success = 0;
    this.failure = 0;
    this.meta = [];
    this.errors = [];
    this.timerStopped = false;
    // Configure
    this.apiUrl = apiUrl;
    this.interval = interval;
    this.apiNumber = apiNumber;
    this.max = max;
    this.startTime = new Date();
    // Start testing
    timer(0, interval).pipe(
      takeUntil(this.kill$),
      tap(() => {
        for (let count = 0; count < apiNumber; count++) {
          if (this.counter === max) {
            this.kill$.next();
          } else {
            this.get(apiUrl).subscribe(resp => this.handleResult(resp), error => this.handleError(error));
            this.counter++;
          }
        }
      })
    ).subscribe({
      complete: () => {
        this.timerStopped = true;
        this.checkComplete();
      }
    });
  }

  get(url: string): Observable<any> {
    const startTime = new Date();
    const headers: any = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: this.getToken()
    };
    return this.http.get(url, { headers }).pipe(
      map(() => {
        const metaData: MetaData = {
          timecost: (new Date().getTime() - startTime.getTime()) / 1000
        }
        return metaData;
      })
    );
  }

  getToken(): string {
    return 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI2NzJDQUYyNy1GNTM2LTNEQzgtMzNCRC1BNTA5OTc3NUU4OTEiLCJpc3MiOiJBOERERTUzRC04QjBFLTI3OTgtMTNGMi0zMUU5OTZCODUxMTAiLCJzdWIiOiJPdHRvIEdyb3VwIiwiYXVkIjoiQVNPU1AiLCJpYXQiOjE1Nzc4MDgwMDAsImV4cCI6MTYwOTQzMDM5OX0.aZJQlkKBKinjap20azNF54t8SHc7tkPt4_5BIFeFKMw';
  }

  handleResult(result: MetaData): void {
    this.success++;
    this.meta.push(result);
    this.checkComplete();
  }

  handleError(error: any): void {
    this.failure++;
    if (error instanceof HttpErrorResponse) {
      this.errors.push({
        status: error.status,
        error: error.error,
        name: error.name,
        message: error.message
      });
    }
    this.checkComplete();
  }

  checkComplete(): void {
    if (this.timerStopped && this.counter === (this.success + this.failure)) {
      this.complete$.next();
    }
  }

  setupDBConnection(): void {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = event => {
      console.log('createDB onsuccess');
      this.db = event.target['result'];
      this.getHistory().catch(() => {
        this.db.close();
        this.updateDB(this.db.version + 1);
      })
    }
  }

  updateDB(version: number): void {
    const request = indexedDB.open(DB_NAME, version);
    request.onupgradeneeded = event => {
      console.log('updateDB onupgradeneeded');
      this.db = event.target['result'];
      this.createObjects();
      const transaction  = event.target['transaction'];
      transaction.oncomplete = event => {
        console.log('transaction oncomplete');
      }
    };
  }

  createObjects(): void {
    // Create objects and indexes.
    const testStore = this.db.createObjectStore(TEST_OBJSTORE, { autoIncrement : true });
    testStore.createIndex('apiUrl', 'apiUrl', { unique: false });
  }

  getHistory(): Promise<TestMeta[]> {
    return new Promise((resolve, reject) => {
      const tests: TestMeta[] = [];
      this.db.transaction([TEST_OBJSTORE]).objectStore(TEST_OBJSTORE).openCursor().onsuccess = (event) => {
        const cursor = event.target['result'];
        if (cursor) {
          const test = cursor.value as TestMeta;
          test.key = cursor.key;
          tests.push(test);
          cursor.continue();
        }
      };
      resolve(tests);
    });
  }

  storeMeta(): void {
    const testStore = this.db.transaction([TEST_OBJSTORE], 'readwrite').objectStore(TEST_OBJSTORE);
    const addRequest = testStore.add(this.getTestMeta(new Date()));
    addRequest.onsuccess = event => {
      //
    }
  }

  getTestMeta(endTime: Date): TestMeta {
    const meta: TestMeta = {
      apiUrl: this.apiUrl,
      apiNumber: this.apiNumber,
      interval: this.interval,
      totalNumber: this.max,
      startTime: this.startTime,
      endTime: endTime,
      success: this.success,
      failure: this.failure,
      details: this.meta,
      errors: this.errors
    };
    return meta;
  }
}

export interface MetaData {
  timecost: number;
}

export interface TestMeta {
  apiUrl: string;
  apiNumber: number;
  interval: number;
  totalNumber: number;
  startTime: Date;
  endTime: Date;
  success: number;
  failure: number;
  details: MetaData[];
  errors: any[];
  key?: number;
}
