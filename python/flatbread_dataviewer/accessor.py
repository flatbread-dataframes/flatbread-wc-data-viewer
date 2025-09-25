import json
import uuid
from pathlib import Path

import pandas as pd
from jinja2 import Environment, FileSystemLoader


class ViewAccessor:
    def __init__(self, pandas_obj):
        self._obj = pandas_obj
        template_dir = Path(__file__).parent / "templates"
        self._jinja_env = Environment(loader=FileSystemLoader(template_dir))

    @property
    def data_spec(self):
        """Get the data object that would be used by the viewer"""
        return self._prepare_data()

    def _prepare_data(self) -> dict:
        """Convert pandas object to data-viewer format"""
        df = self._obj.to_frame() if isinstance(self._obj, pd.Series) else self._obj

        # Extract dtypes
        dtypes = []
        for col in df.columns:
            dtype = df[col].dtype
            if pd.api.types.is_integer_dtype(dtype):
                dtypes.append('int')
            elif pd.api.types.is_float_dtype(dtype):
                dtypes.append('float')
            elif pd.api.types.is_datetime64_any_dtype(dtype):
                dtypes.append(self._get_date_dtype(df[col]))
            else:
                dtypes.append(None)

        return {
            "values": [
                [None if pd.isna(cell) else cell for cell in row]
                for row in df.values.tolist()
            ],
            "columns": list(df.columns),
            "index": list(df.index),
            "columnNames": df.columns.names,
            "indexNames": df.index.names,
            "dtypes": dtypes
        }

    def _get_date_dtype(self, s: pd.Series):
        """Determine if datetime series should be formatted as date or datetime"""
        # Check if all non-null values have time component of 00:00:00
        s = s.dropna()
        if len(s) == 0:
            return 'datetime'

        # Check if all times are midnight
        has_time = (s.dt.hour != 0) | (s.dt.minute != 0) | (s.dt.second != 0)

        return 'datetime' if has_time.any() else 'date'

    def _repr_html_(self) -> str:
        """Render as HTML for Jupyter display"""
        try:
            data = self._prepare_data()
            viewer_id = f"viewer-{uuid.uuid4()}"

            def json_serializer(obj):
                if pd.isna(obj):
                    return None
                if hasattr(obj, 'isoformat'):
                    return obj.isoformat()
                return str(obj)

            template = self._jinja_env.get_template("viewer.jinja.html")
            return template.render(
                viewer_id=viewer_id,
                data=json.dumps(data, default=json_serializer)
            )
        except Exception as e:
            return f"<div style='color: red;'>Error rendering data viewer: {e}</div>"


# Register the accessor
pd.api.extensions.register_dataframe_accessor("viewer")(ViewAccessor)
pd.api.extensions.register_series_accessor("viewer")(ViewAccessor)
