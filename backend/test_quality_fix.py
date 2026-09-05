import pandas as pd
from app.services.quality_service import QualityService

def test_hospital_data():
    # Create the test dataset according to the prompt
    # 181 rows, 12 columns
    data = []
    
    # 1 complete valid row, duplicated once
    valid_row = {
        'id': 1, 'bed_occupancy_pct': 75.0, 'readmission_rate_pct': 10.0,
        'satisfaction_score': 4.5, 'patient_visits': 100, 'staff_count': 50,
        'avg_wait_minutes': 15, 'avg_bill': 1500, 'operating_cost': 50000,
        'total_revenue': 60000, 'emergency_cases': 20, 'department': 'ER',
        'date': '2023-01-01'
    }
    data.append(valid_row)
    data.append(valid_row) # Duplicate row (1 row duplicate)
    
    # Generate remaining valid rows up to 178
    for i in range(3, 179):
        data.append({
            'id': i, 'bed_occupancy_pct': 75.0, 'readmission_rate_pct': 10.0,
            'satisfaction_score': 4.5, 'patient_visits': 100, 'staff_count': 50,
            'avg_wait_minutes': 15, 'avg_bill': 1500, 'operating_cost': 50000,
            'total_revenue': 60000, 'emergency_cases': 20, 'department': 'ER',
            'date': '2023-01-01'
        })
        
    # Row 179: missing bed_occupancy_pct
    r179 = valid_row.copy()
    r179['id'] = 179
    r179['bed_occupancy_pct'] = None
    data.append(r179)
    
    # Row 180: missing operating_cost, invalid bed_occupancy_pct
    r180 = valid_row.copy()
    r180['id'] = 180
    r180['operating_cost'] = None
    r180['bed_occupancy_pct'] = 118.0 # Invalid
    data.append(r180)
    
    # Row 181: missing satisfaction_score, invalid readmission_rate_pct
    r181 = valid_row.copy()
    r181['id'] = 181
    r181['satisfaction_score'] = None
    r181['readmission_rate_pct'] = -2.0 # Invalid
    data.append(r181)
    
    df = pd.DataFrame(data)
    
    print(f"Total Rows: {len(df)}")
    print(f"Total Cols: {len(df.columns)}")
    
    res = QualityService.evaluate_quality(df, "test")
    
    print(f"Missing Cells: {res.completeness.total_missing_cells}")
    print(f"Duplicate Rows: {res.uniqueness.duplicate_rows}")
    print(f"Invalid Cells: {res.validity.total_invalid_cells}")
    print(f"Quality Score: {res.score.overall_score}")
    print(f"Validity Score: {res.score.validity_score}")
    print(f"Issues: {[issue.description for issue in res.issues]}")

if __name__ == "__main__":
    test_hospital_data()
