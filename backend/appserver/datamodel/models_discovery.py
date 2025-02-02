import importlib
import traceback
import pkgutil
import inspect
from pathlib import Path
from appserver.datamodel.database import Base

def discover_models():
    try:
        """Automatically discover and import all model classes that inherit from Base"""
        # Get the path to the datamodel directory
        datamodel_path = Path(__file__).parent
        
        # Iterate through all Python files in the datamodel directory
        for (_, module_name, _) in pkgutil.iter_modules([str(datamodel_path)]):
            # Skip the current module and database.py to avoid circular imports
            if module_name in ['model_discovery', 'database']:
                continue
                
            # Import the module
            module = importlib.import_module(f'appserver.datamodel.{module_name}')
            
            # Find all classes in the module that inherit from Base
            for name, obj in inspect.getmembers(module):
                if (inspect.isclass(obj) and 
                    issubclass(obj, Base) and 
                    obj != Base):
                    # The class is already registered with Base at this point
                    # just by being imported and inheriting from Base
                    print(f"Discovered model: {obj.__name__}")
    except Exception as e:
        print(f"Error discovering models: {traceback.format_exc()}")

